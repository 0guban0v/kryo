import type { Logger } from "../logger.js";
import type {
  GitForgeProvider,
  GitHubCheckRun,
  GitHubCheckSummary,
  GitHubMergeMethod,
  GitHubPullRequest,
  GitHubStatusContext,
} from "../types.js";
import { HttpError, requestJson, requestRaw } from "../utils/http.js";

interface GitHubCombinedStatus {
  state: string;
  statuses: GitHubStatusContext[];
}

interface GitHubCheckRunsResponse {
  check_runs: GitHubCheckRun[];
}

export class GitForgeClient {
  constructor(
    private readonly options: {
      provider: GitForgeProvider;
      apiUrl: string;
      token?: string | undefined;
      defaultRepo?: string | undefined;
      allowRepoOverride: boolean;
      defaultBranch: string;
      mergeMethod: GitHubMergeMethod;
      supportsCheckRuns?: boolean | undefined;
      timeoutMs?: number | undefined;
      logger?: Logger | undefined;
    },
  ) {}

  resolveRepo(repo?: string): string {
    if (repo) {
      if (
        this.options.defaultRepo &&
        !this.options.allowRepoOverride &&
        repo !== this.options.defaultRepo
      ) {
        throw new Error(
          `Repo overrides are disabled. Requested ${repo}, but GIT_FORGE_REPO is locked to ${this.options.defaultRepo}.`,
        );
      }

      return repo;
    }

    if (this.options.defaultRepo) {
      return this.options.defaultRepo;
    }

    throw new Error(
      "No git forge repo was provided and GIT_FORGE_REPO is not configured.",
    );
  }

  resolveBaseBranch(baseBranch?: string): string {
    return baseBranch ?? this.options.defaultBranch;
  }

  async createPullRequest(input: {
    repo?: string | undefined;
    head: string;
    base?: string | undefined;
    title: string;
    body?: string | undefined;
  }): Promise<GitHubPullRequest> {
    const repo = this.resolveRepo(input.repo);

    return requestJson<GitHubPullRequest>(
      this.options.apiUrl,
      `/repos/${repo}/pulls`,
      {
        method: "POST",
        headers: this.requestHeaders(),
        body: {
          title: input.title,
          head: input.head,
          base: this.resolveBaseBranch(input.base),
          body: input.body,
        },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async getPullRequest(
    repo: string | undefined,
    prNumber: number,
  ): Promise<GitHubPullRequest> {
    return requestJson<GitHubPullRequest>(
      this.options.apiUrl,
      `/repos/${this.resolveRepo(repo)}/pulls/${prNumber}`,
      {
        headers: this.requestHeaders(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async mergePullRequest(input: {
    repo?: string | undefined;
    prNumber: number;
    commitTitle?: string | undefined;
  }): Promise<{ merged: boolean; message: string }> {
    const repo = this.resolveRepo(input.repo);

    // GitHub returns JSON { merged, message }; Gitea returns 200 with empty body.
    const response = await requestRaw(
      this.options.apiUrl,
      `/repos/${repo}/pulls/${input.prNumber}/merge`,
      {
        method: this.options.provider === "gitea" ? "POST" : "PUT",
        headers: this.requestHeaders(),
        body: this.mergePayload(input.commitTitle),
        timeoutMs: this.options.timeoutMs,
      },
    );
    const text = await response.text();
    if (text) {
      return JSON.parse(text) as { merged: boolean; message: string };
    }
    return { merged: true, message: "Pull Request successfully merged" };
  }

  async getPullRequestChecks(
    repo: string | undefined,
    prNumber: number,
  ): Promise<GitHubCheckSummary> {
    const resolvedRepo = this.resolveRepo(repo);
    const pullRequest = await this.getPullRequest(resolvedRepo, prNumber);
    const sha = pullRequest.head.sha;

    const [combinedStatus, checkRunsResponse] = await Promise.all([
      this.getCombinedStatus(resolvedRepo, sha),
      this.getCheckRunsWithFallback(resolvedRepo, sha),
    ]);

    return {
      overall: this.resolveOverallState(
        combinedStatus.state,
        checkRunsResponse,
      ),
      headSha: sha,
      combinedState: combinedStatus.state,
      statuses: combinedStatus.statuses,
      checkRuns: checkRunsResponse,
    };
  }

  private async getCombinedStatus(
    repo: string,
    sha: string,
  ): Promise<GitHubCombinedStatus> {
    const result = await requestJson<GitHubCombinedStatus>(
      this.options.apiUrl,
      `/repos/${repo}/commits/${sha}/status`,
      {
        headers: this.requestHeaders(),
        timeoutMs: this.options.timeoutMs,
      },
    );
    // Gitea returns `statuses: null` when there are no statuses; normalise to [].
    return { ...result, statuses: result.statuses ?? [] };
  }

  private async getCheckRunsWithFallback(
    repo: string,
    sha: string,
  ): Promise<GitHubCheckRun[]> {
    if (this.options.supportsCheckRuns === false) {
      return [];
    }

    try {
      const response = await requestJson<GitHubCheckRunsResponse>(
        this.options.apiUrl,
        `/repos/${repo}/commits/${sha}/check-runs`,
        {
          headers: this.requestHeaders(),
          timeoutMs: this.options.timeoutMs,
        },
      );

      return response.check_runs;
    } catch (error) {
      if (this.isUnsupportedCheckRunError(error)) {
        this.options.logger?.info(
          "Git forge check-runs endpoint unavailable, falling back to commit statuses only.",
          {
            provider: this.options.provider,
            apiUrl: this.options.apiUrl,
            sha,
          },
        );
        return [];
      }

      throw error;
    }
  }

  private resolveOverallState(
    combinedState: string,
    checkRuns: GitHubCheckRun[],
  ): GitHubCheckSummary["overall"] {
    const pendingCheck = checkRuns.some((checkRun) =>
      ["queued", "in_progress", "waiting"].includes(checkRun.status),
    );

    if (combinedState === "failure" || combinedState === "error") {
      return "failure";
    }

    if (pendingCheck || combinedState === "pending") {
      return "pending";
    }

    const failedCheck = checkRuns.some((checkRun) =>
      ["failure", "cancelled", "timed_out", "action_required"].includes(
        checkRun.conclusion ?? "",
      ),
    );

    if (failedCheck) {
      return "failure";
    }

    const successfulChecks = checkRuns.length
      ? checkRuns.every((checkRun) =>
          ["success", "neutral", "skipped"].includes(checkRun.conclusion ?? ""),
        )
      : // An empty combined state means no CI has run — treat as pass when
        // there are also no check runs (i.e. forge has no checks configured).
        combinedState === "success" || combinedState === "";

    if (successfulChecks) {
      return "success";
    }

    return "unknown";
  }

  private requestHeaders(): HeadersInit {
    if (!this.options.token) {
      throw new Error(
        "GIT_FORGE_TOKEN is required for git forge workflows such as submit_for_review and complete_work.",
      );
    }

    const headers: Record<string, string> = {
      Accept:
        this.options.provider === "gitea"
          ? "application/json"
          : "application/vnd.github+json",
      Authorization: this.authorizationHeader(),
    };

    if (this.options.provider !== "gitea") {
      headers["X-GitHub-Api-Version"] = "2022-11-28";
    }

    return headers;
  }

  private authorizationHeader(): string {
    return this.options.provider === "gitea"
      ? `token ${this.options.token}`
      : `Bearer ${this.options.token}`;
  }

  private mergePayload(
    commitTitle?: string,
  ): Record<string, string | undefined> {
    if (this.options.provider === "gitea") {
      return {
        Do: this.options.mergeMethod,
      };
    }

    return {
      merge_method: this.options.mergeMethod,
      commit_title: commitTitle,
    };
  }

  private isUnsupportedCheckRunError(error: unknown): boolean {
    return error instanceof HttpError && [404, 405, 501].includes(error.status);
  }
}
