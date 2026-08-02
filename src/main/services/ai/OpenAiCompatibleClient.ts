import type { AiSettings } from "@shared/types";
import type { AppLogger } from "../AppLogger";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const chatCompletionsUrl = (baseUrl: string): string => `${trimTrailingSlash(baseUrl)}/chat/completions`;
const modelsUrl = (baseUrl: string): string => `${trimTrailingSlash(baseUrl)}/models`;

export class OpenAiCompatibleClient {
  constructor(private readonly logger?: AppLogger) {}

  async listModels(settings: AiSettings): Promise<string[]> {
    const data = await this.requestJson(settings, modelsUrl(settings.baseUrl), { method: "GET" });
    if (!data || typeof data !== "object" || !Array.isArray((data as { data?: unknown }).data)) {
      throw new Error("模型服务返回格式不兼容");
    }
    return (data as { data: unknown[] }).data
      .map((item) => (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : ""))
      .filter(Boolean);
  }

  async complete(settings: AiSettings, messages: ChatMessage[]): Promise<string> {
    if (!settings.model.trim()) throw new Error("请先配置模型名称");
    const data = await this.requestJson(settings, chatCompletionsUrl(settings.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: settings.model, messages, temperature: settings.temperature, stream: false })
    });
    const content = data && typeof data === "object" && Array.isArray((data as { choices?: unknown }).choices)
      ? (data as { choices: unknown[] }).choices[0]
      : undefined;
    const text = content && typeof content === "object" && (content as { message?: unknown }).message && typeof (content as { message: { content?: unknown } }).message.content === "string"
      ? (content as { message: { content: string } }).message.content.trim()
      : "";
    if (!text) throw new Error("模型没有返回有效内容");
    return text;
  }

  private async requestJson(settings: AiSettings, url: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(this.httpError(response.status));
      try {
        return await response.json();
      } catch {
        throw new Error("模型服务返回的数据不是有效 JSON");
      }
    } catch (error) {
      const message = this.mapError(error);
      this.logger?.warn("ai.connection.failed", { message });
      throw new Error(message);
    } finally {
      clearTimeout(timer);
    }
  }

  private httpError(status: number): string {
    if (status === 401 || status === 403) return "模型服务拒绝访问";
    if (status === 404) return "模型接口地址不正确";
    if (status === 429) return "模型服务请求过于频繁";
    if (status >= 500) return "模型服务内部错误";
    return `模型服务请求失败（HTTP ${status}）`;
  }

  private mapError(error: unknown): string {
    if (error instanceof Error && error.message.startsWith("模型")) return error.message;
    if (error instanceof Error && error.name === "AbortError") return "模型响应超时";
    if (error instanceof TypeError || (error instanceof Error && /fetch|connect|ECONNREFUSED/i.test(error.message))) {
      return "无法连接本地模型服务，请确认服务已启动";
    }
    return error instanceof Error ? error.message : "模型服务请求失败";
  }
}
