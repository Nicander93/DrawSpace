import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { LOG_FILENAME, LOG_ROTATED_FILENAME } from "@shared/brand";

type LogLevel = "debug" | "info" | "warn" | "error";

export class AppLogger {
  private readonly logDirectory: string;
  private readonly logPath: string;
  private writeQueue = Promise.resolve();

  constructor(userDataPath: string) {
    this.logDirectory = resolve(userDataPath, "logs");
    this.logPath = resolve(this.logDirectory, LOG_FILENAME);
  }

  async initialize(): Promise<void> {
    await mkdir(this.logDirectory, { recursive: true });
    try {
      const logStat = await stat(this.logPath);
      if (logStat.size > 5 * 1024 * 1024) {
        const previousLogPath = resolve(this.logDirectory, LOG_ROTATED_FILENAME);
        await unlink(previousLogPath).catch(() => undefined);
        await rename(this.logPath, previousLogPath);
      }
    } catch {
      return;
    }
  }

  debug(event: string, details?: Record<string, unknown>): void {
    this.write("debug", event, details);
  }

  info(event: string, details?: Record<string, unknown>): void {
    this.write("info", event, details);
  }

  warn(event: string, details?: Record<string, unknown>): void {
    this.write("warn", event, details);
  }

  error(event: string, error?: unknown): void {
    this.write("error", event, {
      message: error instanceof Error ? error.message : String(error ?? "")
    });
  }

  private write(
    level: LogLevel,
    event: string,
    details?: Record<string, unknown>
  ): void {
    const logEntry = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details
    })}\n`;
    this.writeQueue = this.writeQueue
      .then(() => appendFile(this.logPath, logEntry, "utf8"))
      .catch(() => undefined);
  }
}
