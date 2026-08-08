import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiSettings } from "@shared/types";
import { aiSettingsSchema } from "@shared/schemas";
import type { AppLogger } from "../AppLogger";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: "http://127.0.0.1:1234/v1",
  model: "ornith-1.0-9b",
  visionModel: undefined,
  temperature: 0.2,
  timeoutMs: 120_000
};

export class AiSettingsService {
  private readonly settingsPath: string;

  constructor(
    private readonly userDataPath: string,
    private readonly logger?: AppLogger
  ) {
    this.settingsPath = join(userDataPath, "ai-settings.json");
  }

  async get(): Promise<AiSettings> {
    try {
      const content = await readFile(this.settingsPath, "utf8");
      const parsed: unknown = JSON.parse(content);
      return this.normalize(parsed);
    } catch (error) {
      this.logger?.warn("ai.settings.read.failed", error instanceof Error ? { message: error.message } : undefined);
      return { ...DEFAULT_AI_SETTINGS };
    }
  }

  async save(settings: AiSettings): Promise<AiSettings> {
    const validated = aiSettingsSchema.parse(settings);
    await mkdir(this.userDataPath, { recursive: true });
    const temporaryPath = `${this.settingsPath}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(validated, null, 2), "utf8");
      await rename(temporaryPath, this.settingsPath);
      return validated;
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }

  private normalize(value: unknown): AiSettings {
    if (!value || typeof value !== "object") return { ...DEFAULT_AI_SETTINGS };
    const candidate = value as Partial<AiSettings>;
    const normalized = {
      ...DEFAULT_AI_SETTINGS,
      ...(typeof candidate.baseUrl === "string" ? { baseUrl: candidate.baseUrl } : {}),
      ...(typeof candidate.model === "string" ? { model: candidate.model } : {}),
      ...(typeof candidate.visionModel === "string" ? { visionModel: candidate.visionModel } : {}),
      ...(typeof candidate.temperature === "number" ? { temperature: candidate.temperature } : {}),
      ...(typeof candidate.timeoutMs === "number" ? { timeoutMs: candidate.timeoutMs } : {})
    };
    const parsed = aiSettingsSchema.safeParse(normalized);
    return parsed.success ? parsed.data : { ...DEFAULT_AI_SETTINGS };
  }
}
