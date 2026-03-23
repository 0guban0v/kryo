import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

const baseEnv = {
  FIZZY_URL: "http://fizzy.internal",
  FIZZY_API_TOKEN: "fizzy-token",
  FIZZY_ACCOUNT_ID: "account-1",
  CAMPFIRE_URL: "http://campfire.internal",
  BOT_WEBHOOK_AUTH: "none",
};

test("agent mode requires model configuration", () => {
  assert.throws(
    () =>
      loadConfig({
        ...baseEnv,
        BOT_MODE: "agent",
      }),
    /LLM_BASE_URL and LLM_MODEL are required/,
  );
});

test("agent mode accepts OpenAI-compatible local model configuration", () => {
  const config = loadConfig({
    ...baseEnv,
    BOT_MODE: "agent",
    LLM_BASE_URL: "http://127.0.0.1:8000",
    LLM_MODEL: "Qwen/Qwen3-14B-MLX-4bit",
    LLM_LOG_IO: "true",
    BOT_REPO_PATH: "/tmp/kryo-repo",
  });

  assert.equal(config.bot.mode, "agent");
  assert.equal(config.llm.baseUrl, "http://127.0.0.1:8000");
  assert.equal(config.llm.model, "Qwen/Qwen3-14B-MLX-4bit");
  assert.equal(config.llm.logIo, true);
  assert.equal(config.repo.rootPath, "/tmp/kryo-repo");
});
