import { describe, expect, it } from "vitest";
import { AiPromptBuilder } from "@main/services/ai/AiPromptBuilder";

const selection = {
  summary: "两个节点和一条关系",
  nodes: [{ alias: "N1", sourceElementId: "uuid-secret", id: "N1", label: "开始", elementType: "rectangle" }, { alias: "N2", sourceElementId: "uuid-secret-2", id: "N2", label: "结束", elementType: "rectangle" }],
  edges: [{ fromAlias: "N1", toAlias: "N2", from: "uuid-secret", to: "uuid-secret-2", label: "完成" }],
  elementCount: 3
};

describe("AiPromptBuilder", () => {
  const builder = new AiPromptBuilder();
  it("使用短别名且不泄露原始元素 ID", () => {
    const prompt = builder.build({ mode: "extend_selection", prompt: "增加通知", selection });
    expect(prompt).toContain("N1");
    expect(prompt).not.toContain("uuid-secret");
  });
  it("基于 Mermaid 修改只携带基准源码和当前要求", () => {
    const prompt = builder.build({ mode: "revise", prompt: "换成纵向", baseMermaid: "flowchart LR\nA-->B" });
    expect(prompt).toContain("flowchart LR");
    expect(prompt).not.toContain("历史消息");
  });
  it("支持带图片的多模态消息", () => {
    const messages = builder.buildMessages({ mode: "reference_image", prompt: "参考布局", images: ["data:image/png;base64,AA=="] });
    expect(messages[1]?.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image_url" })]));
  });
});
