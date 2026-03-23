import { FizzyClient } from "./adapters/fizzy.js";
import { GitForgeClient } from "./adapters/github.js";
import type { AppConfig } from "./config.js";
import { Logger } from "./logger.js";

export interface MissionControlServices {
  config: AppConfig;
  logger: Logger;
  fizzy: FizzyClient;
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
      selection: config.fizzy.selection,
      timeoutMs: config.requestTimeoutMs,
      logger,
    }),
    github: new GitForgeClient({
      provider: config.github.provider,
      apiUrl: config.github.apiUrl,
      token: config.github.token,
      defaultRepo: config.github.defaultRepo,
      allowRepoOverride: config.github.allowRepoOverride,
      defaultBranch: config.github.defaultBranch,
      mergeMethod: config.github.mergeMethod,
      supportsCheckRuns: config.github.capabilities.checkRuns,
      timeoutMs: config.requestTimeoutMs,
      logger,
    }),
  };
}
