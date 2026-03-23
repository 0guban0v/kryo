import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalRepoClient } from "../src/local-repo/client.js";

test("local repo client blocks paths outside the configured root", async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), "kryo-local-repo-"));
  const client = new LocalRepoClient({
    rootPath,
    defaultBranch: "main",
    remoteName: "origin",
  });

  await assert.rejects(
    client.readFile("../escape.txt"),
    /escapes the configured repo root/,
  );
});

test("local repo client reads and replaces files inside the repo root", async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), "kryo-local-repo-"));
  await mkdir(path.join(rootPath, "src"), { recursive: true });
  await writeFile(path.join(rootPath, "src", "app.ts"), "const answer = 1;\n");

  const client = new LocalRepoClient({
    rootPath,
    defaultBranch: "main",
    remoteName: "origin",
  });

  assert.equal(await client.readFile("src/app.ts"), "const answer = 1;\n");
  await client.replaceInFile("src/app.ts", "1", "2");
  assert.equal(await client.readFile("src/app.ts"), "const answer = 2;\n");
});
