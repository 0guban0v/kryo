import { CampfireClient } from "./adapters/campfire.js";
import { FizzyClient } from "./adapters/fizzy.js";
import { GitForgeClient } from "./adapters/github.js";
import type { AppConfig } from "./config.js";
import { Logger } from "./logger.js";

export interface MissionControlServices {
  config: AppConfig;
  logger: Logger;
  fizzy: FizzyClient;
  campfire: CampfireClient;
  github: GitForgeClient;
}

export function createServices(
  config: AppConfig,
  logger = new Logger(config.logLevel),
): MissionControlServices {
  return {
    config,
    logger,
    fizzy: new FizzyClient({
      baseUrl: config.fizzy.baseUrl,
      accountId: config.fizzy.accountId,
      apiToken: config.fizzy.apiToken,
      defaultBoardId: config.fizzy.defaultBoardId,
      timeoutMs: config.requestTimeoutMs,
      logger,
    }),
    campfire: new CampfireClient({
      baseUrl: config.campfire.baseUrl,
      botKey: config.campfire.botKey,
      defaultRoomId: config.campfire.defaultRoomId,
      sessionCookie: config.campfire.sessionCookie,
      timeoutMs: config.requestTimeoutMs,
      logger,
    }),
    github: new GitForgeClient({
      provider: config.github.provider,
      apiUrl: config.github.apiUrl,
      token: config.github.token,
      defaultRepo: config.github.defaultRepo,
      defaultBranch: config.github.defaultBranch,
      mergeMethod: config.github.mergeMethod,
      timeoutMs: config.requestTimeoutMs,
      logger,
    }),
  };
}
