import assert from "node:assert/strict";
import test from "node:test";

import { GitForgeClient } from "../src/adapters/github.js";
import { loadConfig } from "../src/config.js";

test("git forge repo overrides are disabled by default", () => {
  const config = loadConfig({
    FIZZY_URL: "http://fizzy.internal",
    FIZZY_API_TOKEN: "fizzy-token",
    FIZZY_ACCOUNT_ID: "account-1",
    CAMPFIRE_URL: "http://campfire.internal",
    GIT_FORGE_PROVIDER: "gitea",
    GIT_FORGE_API_URL: "http://gitea.internal/api/v1",
    GIT_FORGE_REPO: "kryo-service/target-service",
  });

  assert.equal(config.github.allowRepoOverride, false);
});

test("git forge client rejects repo overrides when locked", () => {
  const client = new GitForgeClient({
    provider: "gitea",
    apiUrl: "http://gitea.internal/api/v1",
    token: "token",
    defaultRepo: "kryo-service/target-service",
    allowRepoOverride: false,
    defaultBranch: "main",
    mergeMethod: "squash",
  });

  assert.equal(client.resolveRepo(), "kryo-service/target-service");
  assert.equal(
    client.resolveRepo("kryo-service/target-service"),
    "kryo-service/target-service",
  );
  assert.throws(
    () => client.resolveRepo("other-org/other-repo"),
    /Repo overrides are disabled/,
  );
});

test("git forge client allows explicit repo overrides when enabled", () => {
  const client = new GitForgeClient({
    provider: "gitea",
    apiUrl: "http://gitea.internal/api/v1",
    token: "token",
    defaultRepo: "kryo-service/target-service",
    allowRepoOverride: true,
    defaultBranch: "main",
    mergeMethod: "squash",
  });

  assert.equal(
    client.resolveRepo("other-org/other-repo"),
    "other-org/other-repo",
  );
});
