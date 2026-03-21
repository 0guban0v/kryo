import "dotenv/config";

import { z } from "zod";

import type {
  GitForgeProvider,
  GitHubMergeMethod,
  TransportMode,
} from "./types.js";

const envSchema = z.object({
  FIZZY_URL: z.string().url(),
  FIZZY_API_TOKEN: z.string().min(1),
  FIZZY_ACCOUNT_ID: z.string().min(1),
  FIZZY_BOARD_ID: z.string().min(1).optional(),
  CAMPFIRE_URL: z.string().url(),
  CAMPFIRE_BOT_KEY: z.string().min(1).optional(),
  CAMPFIRE_ROOM_ID: z.string().min(1).optional(),
  CAMPFIRE_SESSION_COOKIE: z.string().min(1).optional(),
  GIT_FORGE_PROVIDER: z.enum(["github", "ghes", "gitea"]).default("github"),
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_REPO: z.string().min(1).optional(),
  GITHUB_DEFAULT_BRANCH: z.string().min(1).default("main"),
  GITHUB_MERGE_METHOD: z.enum(["merge", "squash", "rebase"]).default("squash"),
  MCP_TRANSPORT: z.enum(["stdio", "streamable-http", "sse"]).default("stdio"),
  MCP_HOST: z.string().min(1).default("127.0.0.1"),
  MCP_PORT: z.coerce.number().int().positive().default(3100),
  MCP_PATH: z.string().min(1).default("/mcp"),
  MCP_SSE_PATH: z.string().min(1).default("/sse"),
  MCP_SSE_MESSAGES_PATH: z.string().min(1).default("/messages"),
  BOT_WEBHOOK_PATH: z.string().min(1).default("/campfire/webhook"),
  BOT_WEBHOOK_SHARED_SECRET: z.string().min(1).optional(),
  BOT_WEBHOOK_SHARED_SECRET_HEADER: z
    .string()
    .min(1)
    .default("x-mission-control-webhook-secret"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface AppConfig {
  fizzy: {
    baseUrl: string;
    apiToken: string;
    accountId: string;
    defaultBoardId?: string;
  };
  campfire: {
    baseUrl: string;
    botKey?: string;
    defaultRoomId?: string;
    sessionCookie?: string;
  };
  github: {
    provider: GitForgeProvider;
    apiUrl: string;
    token?: string;
    defaultRepo?: string;
    defaultBranch: string;
    mergeMethod: GitHubMergeMethod;
  };
  mcp: {
    transport: TransportMode;
    host: string;
    port: number;
    path: string;
    ssePath: string;
    sseMessagesPath: string;
  };
  bot: {
    webhookPath: string;
    sharedSecret?: string;
    sharedSecretHeader: string;
  };
  requestTimeoutMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);

  return {
    fizzy: {
      baseUrl: trimTrailingSlash(env.FIZZY_URL),
      apiToken: env.FIZZY_API_TOKEN,
      accountId: env.FIZZY_ACCOUNT_ID,
      ...(env.FIZZY_BOARD_ID ? { defaultBoardId: env.FIZZY_BOARD_ID } : {}),
    },
    campfire: {
      baseUrl: trimTrailingSlash(env.CAMPFIRE_URL),
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
    },
    mcp: {
      transport: env.MCP_TRANSPORT,
      host: env.MCP_HOST,
      port: env.MCP_PORT,
      path: env.MCP_PATH,
      ssePath: env.MCP_SSE_PATH,
      sseMessagesPath: env.MCP_SSE_MESSAGES_PATH,
    },
    bot: {
      webhookPath: env.BOT_WEBHOOK_PATH,
      sharedSecretHeader: env.BOT_WEBHOOK_SHARED_SECRET_HEADER,
      ...(env.BOT_WEBHOOK_SHARED_SECRET
        ? { sharedSecret: env.BOT_WEBHOOK_SHARED_SECRET }
        : {}),
    },
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
  };
}
