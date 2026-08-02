import type {
  AiConnectionTestResult,
  AiSettings,
  GenerateMermaidRequest,
  GenerateMermaidResult,
  RepairMermaidRequest
} from "@shared/types";
import { aiSettingsSchema } from "@shared/schemas";
import type { AppLogger } from "../AppLogger";
import { AiSettingsService } from "./AiSettingsService";
import { extractMermaidContent } from "./mermaidResponse";
import { OpenAiCompatibleClient, type ChatMessage } from "./OpenAiCompatibleClient";

const SYSTEM_PROMPT = `你是 DrawSpace 的 Mermaid 图表生成器。

你的任务是根据用户需求生成一份有效的 Mermaid 源码。

严格要求：
1. 只输出 Mermaid 源码，不要输出解释。
2. 不要使用 Markdown 代码块。
3. 优先使用 flowchart、sequenceDiagram、classDiagram、stateDiagram-v2、erDiagram。
4. 节点 ID 使用简短英文、数字或下划线，中文内容放在节点标签中。
5. 不要使用 click、HTML、外部链接、图标、脚本、classDef 或 style。
6. 图表应简洁，避免无意义中间节点。
7. 参考现有图时只生成新增部分，不要重复复制现有图。
8. 确保 Mermaid 语法完整。`;

export class AiDiagramService {
  constructor(
    private readonly settingsService: AiSettingsService,
    private readonly client: OpenAiCompatibleClient,
    private readonly logger?: AppLogger
  ) {}

  getSettings(): Promise<AiSettings> { return this.settingsService.get(); }
  saveSettings(settings: AiSettings): Promise<AiSettings> { return this.settingsService.save(aiSettingsSchema.parse(settings)); }

  async testConnection(overrideSettings?: AiSettings): Promise<AiConnectionTestResult> {
    const settings = overrideSettings ? aiSettingsSchema.parse(overrideSettings) : await this.settingsService.get();
    const startedAt = Date.now();
    try {
      const models = await this.client.listModels(settings);
      return { success: true, message: models.length ? `连接成功，检测到模型：${models.join("、")}` : "连接成功，但服务没有返回模型列表", latencyMs: Date.now() - startedAt, models };
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接模型服务失败";
      return { success: false, message, latencyMs: Date.now() - startedAt };
    }
  }

  async generate(request: GenerateMermaidRequest): Promise<GenerateMermaidResult> {
    const settings = await this.settingsService.get();
    const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: this.buildPrompt(request) }];
    try {
      const rawResponse = await this.client.complete(settings, messages);
      try {
        return { mermaid: extractMermaidContent(rawResponse), rawResponse };
      } catch (error) {
        this.logger?.warn("ai.mermaid.extract.failed", error instanceof Error ? { message: error.message } : undefined);
        throw error;
      }
    } catch (error) {
      this.logger?.warn("ai.generate.failed", error instanceof Error ? { message: error.message } : undefined);
      throw error;
    }
  }

  async repair(request: RepairMermaidRequest): Promise<GenerateMermaidResult> {
    const settings = await this.settingsService.get();
    const prompt = `下面的 Mermaid 无法解析。\n\n用户原始需求：\n${request.prompt}\n\nMermaid：\n${request.mermaid}\n\n解析错误：\n${request.parseError}\n\n请修复 Mermaid 语法。只输出修复后的 Mermaid 源码，不要输出解释或 Markdown 代码块，保持原图语义。`;
    const rawResponse = await this.client.complete(settings, [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }]);
    try {
      return { mermaid: extractMermaidContent(rawResponse), rawResponse };
    } catch (error) {
      this.logger?.warn("ai.mermaid.extract.failed", error instanceof Error ? { message: error.message } : undefined);
      throw error;
    }
  }

  private buildPrompt(request: GenerateMermaidRequest): string {
    if (!request.selection) return `用户需求：\n${request.prompt}\n\n请生成合适的 Mermaid 图表。`;
    const nodes = request.selection.nodes.map((node) => `- ${node.id}: ${node.label}`).join("\n") || "- 无";
    const edges = request.selection.edges.map((edge) => `- ${edge.from ?? "?"} -> ${edge.to ?? "?"}: ${edge.label ?? ""}`).join("\n") || "- 无";
    return `当前选区摘要：\n${request.selection.summary}\n\n当前选区节点：\n${nodes}\n\n当前选区关系：\n${edges}\n\n用户需求：\n${request.prompt}\n\n请只生成需要新增的图表内容，不要重复绘制当前选区已经存在的内容。`;
  }
}
