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
  it("保留 provider 错误详情并映射不支持图片的提示", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Model does not support image input" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response("invalid request payload", { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "context is too large" }), { status: 400 }));
    const client = new OpenAiCompatibleClient();

    await expect(client.complete(settings, [{ role: "user", content: "看图" }]))
      .rejects.toThrow("当前视觉模型不支持图片输入，请更换支持视觉能力的模型");
    await expect(client.listModels(settings)).rejects.toThrow("模型服务请求失败：invalid request payload");
    await expect(client.listModels(settings)).rejects.toThrow("模型服务请求失败：context is too large");
    fetchMock.mockRestore();
  });
  it.each([
    [401, "模型服务拒绝访问"],
    [500, "模型服务内部错误"]
  ])("将 HTTP %i 映射为稳定提示", async (status, message) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("provider detail", { status }));
    await expect(new OpenAiCompatibleClient().listModels(settings)).rejects.toThrow(message);
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
