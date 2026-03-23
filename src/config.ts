import "dotenv/config";

import { z } from "zod";

import type {
  GitForgeProvider,
  GitHubMergeMethod,
  HttpSessionMode,
  TransportMode,
} from "./types.js";
import { normalizeHost } from "./utils/host.js";

const optionalBoolean = z.preprocess((value) => {
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
}, z.boolean().optional());

const booleanWithDefault = (fallback: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return fallback;
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
  }, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

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
  CAMPFIRE_URL: z.string().url(),
  CAMPFIRE_BOT_KEY: optionalNonEmptyString,
  CAMPFIRE_ROOM_ID: optionalNonEmptyString,
  CAMPFIRE_ROOM_SELECTION: z
    .enum(["configured", "require-explicit"])
    .default("configured"),
  CAMPFIRE_SESSION_COOKIE: optionalNonEmptyString,
  CAMPFIRE_TRANSCRIPT_LIMIT: z.coerce.number().int().positive().default(100),
  CAMPFIRE_RECENT_MESSAGES_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(20),
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
  BOT_WEBHOOK_PATH: z.string().min(1).default("/campfire/webhook"),
  BOT_WEBHOOK_AUTH: z.enum(["shared-secret", "none"]).default("shared-secret"),
  BOT_WEBHOOK_SHARED_SECRET: optionalNonEmptyString,
  BOT_WEBHOOK_SHARED_SECRET_HEADER: z
    .string()
    .min(1)
    .default("x-kryo-webhook-secret"),
  BOT_MODE: z.enum(["rules", "agent"]).default("rules"),
  BOT_MAX_AGENT_STEPS: z.coerce.number().int().positive().default(12),
  LLM_BASE_URL: optionalNonEmptyString,
  LLM_MODEL: optionalNonEmptyString,
  LLM_API_KEY: optionalNonEmptyString,
  LLM_LOG_IO: booleanWithDefault(false),
  LLM_CHAT_COMPLETIONS_PATH: z.string().min(1).default("/v1/chat/completions"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  BOT_REPO_PATH: optionalNonEmptyString,
  BOT_REPO_REMOTE: z.string().min(1).default("origin"),
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
  campfire: {
    baseUrl: string;
    botKey?: string;
    defaultRoomId?: string;
    sessionCookie?: string;
    selection: "configured" | "require-explicit";
    transcriptLimit: number;
    recentMessagesLimit: number;
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
  bot: {
    webhookPath: string;
    mode: "rules" | "agent";
    maxAgentSteps: number;
    auth: {
      mode: "shared-secret" | "none";
      sharedSecret?: string;
      headerName: string;
    };
  };
  llm: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    logIo: boolean;
    chatCompletionsPath: string;
    timeoutMs: number;
  };
  repo: {
    rootPath?: string;
    remoteName: string;
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
    return ["127.0.0.1", "localhost", "::1", "mcp"];
  }

  if (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "localhost" ||
    normalizedHost === "::1"
  ) {
    return ["127.0.0.1", "localhost", "::1"];
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

  if (
    env.MCP_TRANSPORT === "streamable-http" &&
    env.BOT_WEBHOOK_AUTH === "shared-secret" &&
    !env.BOT_WEBHOOK_SHARED_SECRET
  ) {
    throw new Error(
      "BOT_WEBHOOK_SHARED_SECRET is required when BOT_WEBHOOK_AUTH=shared-secret and MCP_TRANSPORT=streamable-http. Set BOT_WEBHOOK_AUTH=none only if webhook authentication is enforced outside kryo.",
    );
  }

  if (env.BOT_MODE === "agent" && (!env.LLM_BASE_URL || !env.LLM_MODEL)) {
    throw new Error(
      "LLM_BASE_URL and LLM_MODEL are required when BOT_MODE=agent.",
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
    campfire: {
      baseUrl: trimTrailingSlash(env.CAMPFIRE_URL),
      selection: env.CAMPFIRE_ROOM_SELECTION,
      transcriptLimit: env.CAMPFIRE_TRANSCRIPT_LIMIT,
      recentMessagesLimit: env.CAMPFIRE_RECENT_MESSAGES_LIMIT,
      ...(env.CAMPFIRE_BOT_KEY ? { botKey: env.CAMPFIRE_BOT_KEY } : {}),
      ...(env.CAMPFIRE_ROOM_ID ? { defaultRoomId: env.CAMPFIRE_ROOM_ID } : {}),
      ...(env.CAMPFIRE_SESSION_COOKIE
        ? { sessionCookie: env.CAMPFIRE_SESSION_COOKIE }
        : {}),
    },
    github: {
      provider: env.GIT_FORGE_PROVIDER,
      apiUrl: trimTrailingSlash(env.GIT_FORGE_API_URL),
      ...(env.GIT_FORGE_TOKEN ? { token: env.GIT_FORGE_TOKEN } : {}),
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
    bot: {
      webhookPath: env.BOT_WEBHOOK_PATH,
      mode: env.BOT_MODE,
      maxAgentSteps: env.BOT_MAX_AGENT_STEPS,
      auth: {
        mode: env.BOT_WEBHOOK_AUTH,
        headerName: env.BOT_WEBHOOK_SHARED_SECRET_HEADER,
        ...(env.BOT_WEBHOOK_SHARED_SECRET
          ? { sharedSecret: env.BOT_WEBHOOK_SHARED_SECRET }
          : {}),
      },
    },
    llm: {
      ...(env.LLM_BASE_URL
        ? { baseUrl: trimTrailingSlash(env.LLM_BASE_URL) }
        : {}),
      ...(env.LLM_MODEL ? { model: env.LLM_MODEL } : {}),
      ...(env.LLM_API_KEY ? { apiKey: env.LLM_API_KEY } : {}),
      logIo: env.LLM_LOG_IO,
      chatCompletionsPath: env.LLM_CHAT_COMPLETIONS_PATH,
      timeoutMs: env.LLM_TIMEOUT_MS,
    },
    repo: {
      ...(env.BOT_REPO_PATH ? { rootPath: env.BOT_REPO_PATH } : {}),
      remoteName: env.BOT_REPO_REMOTE,
    },
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
  };
}
