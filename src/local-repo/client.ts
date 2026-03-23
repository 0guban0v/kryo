import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import type { Logger } from "../logger.js";

function trimOutput(value: string, maxLength = 12_000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...truncated...`;
}

function hasShellControlOperators(command: string): boolean {
  return /[|&;`$<>]/.test(command);
}

function tokenizeCommand(command: string): string[] {
  return command
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function sanitizeBranchName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._/-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

export class LocalRepoClient {
  constructor(
    private readonly options: {
      rootPath: string;
      defaultBranch: string;
      remoteName: string;
      logger?: Logger | undefined;
    },
  ) {}

  rootPath(): string {
    return this.options.rootPath;
  }

  async listFiles(relativePath = "."): Promise<string[]> {
    const absolutePath = this.resolvePath(relativePath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.name !== ".git")
      .map((entry) =>
        path.relative(
          this.options.rootPath,
          path.join(absolutePath, entry.name),
        ),
      )
      .sort();
  }

  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(this.resolvePath(relativePath), "utf8");
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
  }

  async replaceInFile(
    relativePath: string,
    oldText: string,
    newText: string,
  ): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    const current = await fs.readFile(absolutePath, "utf8");

    if (!current.includes(oldText)) {
      throw new Error(
        `Unable to find the expected text in ${relativePath}. Refetch the file before replacing it.`,
      );
    }

    await fs.writeFile(
      absolutePath,
      current.replace(oldText, newText),
      "utf8",
    );
  }

  async gitStatus(): Promise<string> {
    return this.run(["git", "status", "--short", "--branch"]);
  }

  async gitDiff(): Promise<string> {
    return this.run(["git", "diff", "--no-ext-diff"]);
  }

  async currentBranch(): Promise<string> {
    return (await this.run(["git", "rev-parse", "--abbrev-ref", "HEAD"])).trim();
  }

  async createBranch(branchName: string): Promise<string> {
    const sanitized = sanitizeBranchName(branchName);
    if (!sanitized) {
      throw new Error("Branch name cannot be empty.");
    }

    if (sanitized === this.options.defaultBranch) {
      throw new Error(
        `Refusing to create or switch to the protected default branch ${sanitized}.`,
      );
    }

    await this.run(["git", "checkout", "-b", sanitized]);
    return sanitized;
  }

  async commitAll(message: string): Promise<string> {
    const branch = await this.currentBranch();
    this.assertNotDefaultBranch(branch);
    await this.run(["git", "add", "--all"]);
    return this.run(["git", "commit", "-m", message]);
  }

  async pushCurrentBranch(): Promise<string> {
    const branch = await this.currentBranch();
    this.assertNotDefaultBranch(branch);
    return this.run([
      "git",
      "push",
      "--set-upstream",
      this.options.remoteName,
      branch,
    ]);
  }

  async runAllowedCommand(command: string): Promise<string> {
    if (hasShellControlOperators(command)) {
      throw new Error(
        "Shell control operators are not allowed in repo commands. Run a single command only.",
      );
    }

    const args = tokenizeCommand(command);
    if (!args.length) {
      throw new Error("Command cannot be empty.");
    }

    const [binary] = args;
    if (!binary) {
      throw new Error("Command cannot be empty.");
    }

    const allowed = new Set([
      "pnpm",
      "npm",
      "yarn",
      "bun",
      "node",
      "npx",
      "pytest",
      "python",
      "python3",
      "uv",
      "go",
      "cargo",
      "make",
      "just",
      "git",
      "rg",
      "sed",
      "cat",
      "ls",
    ]);

    if (!allowed.has(binary)) {
      throw new Error(`Command ${binary} is not allowed.`);
    }

    if (
      binary === "git" &&
      args.some((part) =>
        ["push", "reset", "rebase", "checkout", "switch", "branch"].includes(
          part,
        ),
      )
    ) {
      throw new Error(
        "Use dedicated git actions instead of running state-changing git commands directly.",
      );
    }

    return this.run(args);
  }

  private resolvePath(relativePath: string): string {
    const absolutePath = path.resolve(this.options.rootPath, relativePath);
    const relative = path.relative(this.options.rootPath, absolutePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Path ${relativePath} escapes the configured repo root.`);
    }

    return absolutePath;
  }

  private assertNotDefaultBranch(branch: string): void {
    if (branch === this.options.defaultBranch) {
      throw new Error(
        `Refusing to modify the protected default branch ${this.options.defaultBranch}.`,
      );
    }
  }

  private run(args: string[]): Promise<string> {
    this.options.logger?.debug("Running repo command.", {
      rootPath: this.options.rootPath,
      args,
    });

    return new Promise<string>((resolve, reject) => {
      const child = spawn(args[0] ?? "", args.slice(1), {
        cwd: this.options.rootPath,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        const output = trimOutput([stdout.trim(), stderr.trim()].filter(Boolean).join("\n"));

        if (code === 0) {
          resolve(output || "ok");
          return;
        }

        reject(
          new Error(
            output
              ? `Command failed with exit code ${code}: ${output}`
              : `Command failed with exit code ${code}.`,
          ),
        );
      });
    });
  }
}
