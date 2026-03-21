import "dotenv/config";

import { z } from "zod";

import type {
  GitForgeProvider,
  GitHubMergeMethod,
  TransportMode,
} from "./types.js";

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

const optionalNonEmptyString = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

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
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  GITHUB_TOKEN: optionalNonEmptyString,
  GITHUB_REPO: optionalNonEmptyString,
  GITHUB_DEFAULT_BRANCH: z.string().min(1).default("main"),
  GITHUB_MERGE_METHOD: z.enum(["merge", "squash", "rebase"]).default("squash"),
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
  MCP_HOST: z.string().min(1).default("127.0.0.1"),
  MCP_PORT: z.coerce.number().int().positive().default(3100),
  MCP_PATH: z.string().min(1).default("/mcp"),
  BOT_WEBHOOK_PATH: z.string().min(1).default("/campfire/webhook"),
  BOT_WEBHOOK_SHARED_SECRET: optionalNonEmptyString,
  BOT_WEBHOOK_SHARED_SECRET_HEADER: z
    .string()
    .min(1)
    .default("x-kryo-webhook-secret"),
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
    host: string;
    port: number;
    path: string;
  };
  bot: {
    webhookPath: string;
    auth: {
      sharedSecret?: string;
      headerName: string;
    };
  };
  requestTimeoutMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function defaultCheckRunSupport(provider: GitForgeProvider): boolean {
  return provider !== "gitea";
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);

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
      apiUrl: trimTrailingSlash(env.GITHUB_API_URL),
      ...(env.GITHUB_TOKEN ? { token: env.GITHUB_TOKEN } : {}),
      ...(env.GITHUB_REPO ? { defaultRepo: env.GITHUB_REPO } : {}),
      defaultBranch: env.GITHUB_DEFAULT_BRANCH,
      mergeMethod: env.GITHUB_MERGE_METHOD,
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
      host: env.MCP_HOST,
      port: env.MCP_PORT,
      path: env.MCP_PATH,
    },
    bot: {
      webhookPath: env.BOT_WEBHOOK_PATH,
      auth: {
        headerName: env.BOT_WEBHOOK_SHARED_SECRET_HEADER,
        ...(env.BOT_WEBHOOK_SHARED_SECRET
          ? { sharedSecret: env.BOT_WEBHOOK_SHARED_SECRET }
          : {}),
      },
    },
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
  };
}
