import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiSettingsService, DEFAULT_AI_SETTINGS } from "@main/services/ai/AiSettingsService";

describe("AiSettingsService", () => {
  it("文件不存在时返回默认值", async () => {
    const service = new AiSettingsService(await mkdtemp(join(tmpdir(), "drawspace-ai-")));
    expect(await service.get()).toEqual(DEFAULT_AI_SETTINGS);
  });
  it("保存后可以读取且临时文件被清理", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drawspace-ai-"));
    const service = new AiSettingsService(directory);
    const settings = { ...DEFAULT_AI_SETTINGS, model: "test-model" };
    await service.save(settings);
    expect(await service.get()).toEqual(settings);
    await expect(readFile(join(directory, "ai-settings.json.tmp"))).rejects.toThrow();
  });
  it("无效 JSON 返回默认值", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drawspace-ai-"));
    const service = new AiSettingsService(directory);
    await service.save({ ...DEFAULT_AI_SETTINGS, model: "test" });
    const path = join(directory, "ai-settings.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, "{", "utf8");
    expect(await service.get()).toEqual(DEFAULT_AI_SETTINGS);
  });
  it("无效设置不允许保存", async () => {
    const service = new AiSettingsService(await mkdtemp(join(tmpdir(), "drawspace-ai-")));
    await expect(service.save({ ...DEFAULT_AI_SETTINGS, model: "" })).rejects.toThrow();
  });
});
