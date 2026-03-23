import "dotenv/config";

import { z } from "zod";

import type {
  GitForgeProvider,
  GitHubMergeMethod,
  HttpSessionMode,
  TransportMode,
} from "./types.js";
import { normalizeHost } from "./utils/host.js";

const LOOPBACK_ALLOWED_HOSTS = ["127.0.0.1", "localhost", "::1"] as const;
const WILDCARD_ALLOWED_HOSTS = [...LOOPBACK_ALLOWED_HOSTS, "mcp"] as const;

function preprocessEnvBoolean(value: unknown): boolean | undefined | unknown {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}

function preprocessOptionalString(
  value: unknown,
): string | undefined | unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const optionalBoolean = z.preprocess(
  preprocessEnvBoolean,
  z.boolean().optional(),
);

const booleanWithDefault = (fallback: boolean) =>
  z.preprocess((value) => {
    const parsed = preprocessEnvBoolean(value);
    return parsed === undefined ? fallback : parsed;
  }, z.boolean());

const optionalNonEmptyString = z.preprocess(
  preprocessOptionalString,
  z.string().min(1).optional(),
);

const optionalCommaSeparatedStrings = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return value;
}, z.array(z.string().min(1)).optional());

function firstDefined(
  source: NodeJS.ProcessEnv,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

const envSchema = z.object({
  FIZZY_URL: z.string().url(),
  FIZZY_API_TOKEN: z.string().min(1),
  FIZZY_ACCOUNT_ID: z.string().min(1),
  FIZZY_BOARD_ID: optionalNonEmptyString,
  FIZZY_BOARD_SELECTION: z
    .enum(["configured", "require-explicit"])
    .default("configured"),
  GIT_FORGE_PROVIDER: z.enum(["github", "ghes", "gitea"]).default("github"),
  GIT_FORGE_API_URL: z.string().url().default("https://api.github.com"),
  GIT_FORGE_TOKEN: optionalNonEmptyString,
  GIT_FORGE_REPO: optionalNonEmptyString,
  GIT_FORGE_ALLOW_REPO_OVERRIDE: optionalBoolean,
  GIT_FORGE_DEFAULT_BRANCH: z.string().min(1).default("main"),
  GIT_FORGE_MERGE_METHOD: z
    .enum(["merge", "squash", "rebase"])
    .default("squash"),
  GIT_FORGE_SUPPORTS_CHECK_RUNS: optionalBoolean,
  WORKFLOW_TODO_COLUMN: z.string().min(1).default("To Do"),
  WORKFLOW_IN_PROGRESS_COLUMN: z.string().min(1).default("In Progress"),
  WORKFLOW_REVIEW_COLUMN: z.string().min(1).default("Review"),
  WORKFLOW_BLOCKED_COLUMN: z.string().min(1).default("Blocked"),
  WORKFLOW_DONE_LABEL: z.string().min(1).default("Done"),
  WORKFLOW_NOT_NOW_LABEL: z.string().min(1).default("Not Now"),
  WORKFLOW_TRIAGE_LABEL: z.string().min(1).default("Triage"),
  CARD_DESCRIPTION_PREVIEW_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(500),
  BOARD_STATUS_VISIBLE_CARDS_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  TROUBLESHOOT_ERROR_LIMIT: z.coerce.number().int().positive().default(1500),
  MCP_TRANSPORT: z.enum(["stdio", "streamable-http"]).default("stdio"),
  MCP_HTTP_SESSION_MODE: z.enum(["stateful", "stateless"]).default("stateful"),
  MCP_HOST: z.string().min(1).default("127.0.0.1"),
  MCP_ALLOWED_HOSTS: optionalCommaSeparatedStrings,
  MCP_SESSION_IDLE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1_800_000),
  MCP_MAX_SESSIONS: z.coerce.number().int().positive().default(100),
  MCP_PORT: z.coerce.number().int().positive().default(3100),
  MCP_PATH: z.string().min(1).default("/mcp"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface AppConfig {
  fizzy: {
    baseUrl: string;
    apiToken: string;
    accountId: string;
    defaultBoardId?: string;
    selection: "configured" | "require-explicit";
  };
  github: {
    provider: GitForgeProvider;
    apiUrl: string;
    token?: string;
    defaultRepo?: string;
    allowRepoOverride: boolean;
    defaultBranch: string;
    mergeMethod: GitHubMergeMethod;
    capabilities: {
      checkRuns: boolean;
    };
  };
  workflow: {
    todoColumnName: string;
    inProgressColumnName: string;
    reviewColumnName: string;
    blockedColumnName: string;
    doneLabel: string;
    notNowLabel: string;
    triageLabel: string;
  };
  limits: {
    cardDescriptionPreview: number;
    boardStatusVisibleCards: number;
    troubleshootErrorOutput: number;
  };
  mcp: {
    transport: TransportMode;
    httpSessionMode: HttpSessionMode;
    host: string;
    allowedHosts: string[];
    sessionIdleTtlMs: number;
    maxSessions: number;
    port: number;
    path: string;
  };
  requestTimeoutMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function defaultAllowedHosts(host: string): string[] {
  const normalizedHost = normalizeHost(host);

  if (normalizedHost === "0.0.0.0" || normalizedHost === "::") {
    return [...WILDCARD_ALLOWED_HOSTS];
  }

  if (
    LOOPBACK_ALLOWED_HOSTS.includes(
      normalizedHost as (typeof LOOPBACK_ALLOWED_HOSTS)[number],
    )
  ) {
    return [...LOOPBACK_ALLOWED_HOSTS];
  }

  return [normalizedHost];
}

function defaultCheckRunSupport(provider: GitForgeProvider): boolean {
  return provider !== "gitea";
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse({
    ...source,
    GIT_FORGE_API_URL: firstDefined(
      source,
      "GIT_FORGE_API_URL",
      "GITHUB_API_URL",
    ),
    GIT_FORGE_TOKEN: firstDefined(source, "GIT_FORGE_TOKEN", "GITHUB_TOKEN"),
    GIT_FORGE_REPO: firstDefined(source, "GIT_FORGE_REPO", "GITHUB_REPO"),
    GIT_FORGE_ALLOW_REPO_OVERRIDE: firstDefined(
      source,
      "GIT_FORGE_ALLOW_REPO_OVERRIDE",
    ),
    GIT_FORGE_DEFAULT_BRANCH: firstDefined(
      source,
      "GIT_FORGE_DEFAULT_BRANCH",
      "GITHUB_DEFAULT_BRANCH",
    ),
    GIT_FORGE_MERGE_METHOD: firstDefined(
      source,
      "GIT_FORGE_MERGE_METHOD",
      "GITHUB_MERGE_METHOD",
    ),
  });

  if (!env.GIT_FORGE_TOKEN) {
    throw new Error(
      "GIT_FORGE_TOKEN is required at startup because Kryo exposes git forge workflows.",
    );
  }

  return {
    fizzy: {
      baseUrl: trimTrailingSlash(env.FIZZY_URL),
      apiToken: env.FIZZY_API_TOKEN,
      accountId: env.FIZZY_ACCOUNT_ID,
      selection: env.FIZZY_BOARD_SELECTION,
      ...(env.FIZZY_BOARD_ID ? { defaultBoardId: env.FIZZY_BOARD_ID } : {}),
    },
    github: {
      provider: env.GIT_FORGE_PROVIDER,
      apiUrl: trimTrailingSlash(env.GIT_FORGE_API_URL),
      token: env.GIT_FORGE_TOKEN,
      ...(env.GIT_FORGE_REPO ? { defaultRepo: env.GIT_FORGE_REPO } : {}),
      allowRepoOverride: env.GIT_FORGE_ALLOW_REPO_OVERRIDE ?? false,
      defaultBranch: env.GIT_FORGE_DEFAULT_BRANCH,
      mergeMethod: env.GIT_FORGE_MERGE_METHOD,
      capabilities: {
        checkRuns:
          env.GIT_FORGE_SUPPORTS_CHECK_RUNS ??
          defaultCheckRunSupport(env.GIT_FORGE_PROVIDER),
      },
    },
    workflow: {
      todoColumnName: env.WORKFLOW_TODO_COLUMN,
      inProgressColumnName: env.WORKFLOW_IN_PROGRESS_COLUMN,
      reviewColumnName: env.WORKFLOW_REVIEW_COLUMN,
      blockedColumnName: env.WORKFLOW_BLOCKED_COLUMN,
      doneLabel: env.WORKFLOW_DONE_LABEL,
      notNowLabel: env.WORKFLOW_NOT_NOW_LABEL,
      triageLabel: env.WORKFLOW_TRIAGE_LABEL,
    },
    limits: {
      cardDescriptionPreview: env.CARD_DESCRIPTION_PREVIEW_LIMIT,
      boardStatusVisibleCards: env.BOARD_STATUS_VISIBLE_CARDS_LIMIT,
      troubleshootErrorOutput: env.TROUBLESHOOT_ERROR_LIMIT,
    },
    mcp: {
      transport: env.MCP_TRANSPORT,
      httpSessionMode: env.MCP_HTTP_SESSION_MODE,
      host: env.MCP_HOST,
      allowedHosts:
        env.MCP_ALLOWED_HOSTS?.map((host) => normalizeHost(host)) ??
        defaultAllowedHosts(env.MCP_HOST),
      sessionIdleTtlMs: env.MCP_SESSION_IDLE_TTL_MS,
      maxSessions: env.MCP_MAX_SESSIONS,
      port: env.MCP_PORT,
      path: env.MCP_PATH,
    },
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
  };
}
