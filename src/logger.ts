export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function serialize(meta: unknown): string {
  if (meta === undefined) {
    return "";
  }

  if (typeof meta === "string") {
    return meta;
  }

  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

export class Logger {
  constructor(private readonly minLevel: LogLevel = "info") {}

  debug(message: string, meta?: unknown): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const details = serialize(meta);
    const line = details
      ? `[${timestamp}] ${level.toUpperCase()} ${message} ${details}\n`
      : `[${timestamp}] ${level.toUpperCase()} ${message}\n`;

    process.stderr.write(line);
  }
}
