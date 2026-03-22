import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

function resolveVersion(): string {
  const configured = process.env.KRYO_VERSION?.trim();

  if (configured) {
    return configured;
  }

  try {
    return execFileSync(resolve(process.cwd(), "scripts/git-version.sh"), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export const VERSION = resolveVersion();
