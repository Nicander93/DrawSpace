import type { AiSelectionContext, AiTurnMode } from "@shared/types";
import type { ChatMessage } from "./OpenAiCompatibleClient";

const SYSTEM_PROMPT = `你是 DrawSpace 的 Mermaid 图表生成器。
只输出有效 Mermaid 源码，不要解释、Markdown 代码块、HTML、click、脚本、外部链接、classDef 或 style。
优先使用 flowchart、sequenceDiagram、classDiagram、stateDiagram-v2、erDiagram。
节点 ID 使用简短英文、数字或下划线，中文内容放在节点标签中。图表应简洁并确保语法完整。`;

const selectionText = (selection?: AiSelectionContext): string => {
  if (!selection) return "";
  const aliases = new Map(selection.nodes.map((node) => [node.id ?? node.sourceElementId, node.alias]));
  const nodes = selection.nodes.map((node) => `- ${node.alias}: ${node.label}`).join("\n") || "- 无";
  const edges = selection.edges.map((edge) => `- ${edge.fromAlias ?? aliases.get(edge.from ?? "") ?? "?"} -> ${edge.toAlias ?? aliases.get(edge.to ?? "") ?? "?"}: ${edge.label ?? ""}`).join("\n") || "- 无";
  return `当前选区结构摘要：\n${selection.summary}\n\n节点：\n${nodes}\n\n关系：\n${edges}`;
};

export class AiPromptBuilder {
  build(input: { mode: AiTurnMode; prompt: string; selection?: AiSelectionContext; baseMermaid?: string }): string {
    const context = selectionText(input.selection);
    if (input.mode === "revise") return `基准 Mermaid：\n${input.baseMermaid ?? ""}\n\n修改要求：\n${input.prompt}\n\n只输出修改后的完整 Mermaid。`;
    if (input.mode === "recreate_image") return `请理解图片中的图表结构，并重新生成可编辑 Mermaid。\n\n用户补充要求：\n${input.prompt}\n\n保留主要节点和关系，忽略装饰背景，只输出 Mermaid。`;
    if (input.mode === "reference_image") return `${context ? `${context}\n\n` : ""}图片仅作为布局或内容参考。\n\n用户需求：\n${input.prompt}\n\n根据需求生成 Mermaid，不必逐像素复刻图片。`;
    if (input.mode === "extend_selection") return `${context}\n\n用户需求：\n${input.prompt}\n\n只生成需要新增的内容，不要重复当前选区。V2 会生成独立新图表，不会自动绑定旧元素。`;
    return `${context ? `${context}\n\n` : ""}用户需求：\n${input.prompt}\n\n请生成合适的 Mermaid 图表。`;
  }

  buildMessages(input: { mode: AiTurnMode; prompt: string; selection?: AiSelectionContext; baseMermaid?: string; images?: string[] }): ChatMessage[] {
    const text = this.build(input);
    if (!input.images?.length) return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }];
    return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: [{ type: "text", text }, ...input.images.map((url) => ({ type: "image_url" as const, image_url: { url } }))] }];
  }
}
