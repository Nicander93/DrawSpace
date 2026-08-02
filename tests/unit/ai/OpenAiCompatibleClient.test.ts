import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleClient } from "@main/services/ai/OpenAiCompatibleClient";
import type { AiSettings } from "@shared/types";

const settings: AiSettings = { baseUrl: "http://127.0.0.1:1234/v1", model: "demo", temperature: 0.2, timeoutMs: 5_000 };

describe("OpenAiCompatibleClient", () => {
  it("调用 models 和 chat completions 的兼容接口", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "demo" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "flowchart LR\n A --> B" } }] }), { status: 200 }));
    const client = new OpenAiCompatibleClient();
    expect(await client.listModels(settings)).toEqual(["demo"]);
    expect(await client.complete(settings, [{ role: "user", content: "生成图表" }])).toContain("flowchart LR");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:1234/v1/models");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:1234/v1/chat/completions");
    fetchMock.mockRestore();
  });
  it("将 HTTP 错误转换为中文提示", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(new OpenAiCompatibleClient().listModels(settings)).rejects.toThrow("模型接口地址不正确");
    fetchMock.mockRestore();
  });
  it("超时会终止请求", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    await expect(new OpenAiCompatibleClient().listModels({ ...settings, timeoutMs: 5 })).rejects.toThrow("模型响应超时");
    fetchMock.mockRestore();
  });
});
