import { describe, expect, it } from "vitest";
import { extractMermaidContent } from "@main/services/ai/mermaidResponse";

describe("extractMermaidContent", () => {
  it("提取 mermaid 代码块", () => expect(extractMermaidContent("```mermaid\nflowchart LR\n A --> B\n```")).toBe("flowchart LR\n A --> B"));
  it("提取普通代码块", () => expect(extractMermaidContent("```\nsequenceDiagram\n A->>B: hi\n```")).toContain("sequenceDiagram"));
  it("提取带解释的纯文本 Mermaid", () => expect(extractMermaidContent("结果如下：\nflowchart LR\n A --> B")).toBe("flowchart LR\n A --> B"));
  it("拒绝空结果和无 Mermaid 结果", () => {
    expect(() => extractMermaidContent("")).toThrow();
    expect(() => extractMermaidContent("这不是图表")).toThrow();
  });
  it("拒绝超长结果", () => expect(() => extractMermaidContent(`flowchart LR\n${"A --> B\n".repeat(8_000)}`)).toThrow("过长"));
});
