import { describe, expect, it } from "vitest";
import { extractSelectionContext } from "@renderer/features/ai/SelectionContextExtractor";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const element = (input: Record<string, unknown>): ExcalidrawElement => input as ExcalidrawElement;
const rectangle = (id: string, x = 0, y = 0) => element({ id, type: "rectangle", x, y, width: 100, height: 50 });

describe("extractSelectionContext", () => {
  it("无选区返回 undefined", () => expect(extractSelectionContext([rectangle("a")], {})).toBeUndefined());
  it("提取节点文本和箭头关系", () => {
    const items = [rectangle("a"), { ...element({ id: "ta", type: "text", x: 0, y: 0, width: 20, height: 20, text: "开始", containerId: "a" }), id: "ta" }, { ...element({ id: "ab", type: "arrow", x: 0, y: 0, width: 100, height: 0, points: [[0, 0], [100, 0]], startBinding: { elementId: "a" }, endBinding: { elementId: "b" } }), id: "ab" }, rectangle("b", 200, 0)];
    const context = extractSelectionContext(items, { a: true, ta: true, ab: true, b: true });
    expect(context?.nodes.map((node) => node.label)).toContain("开始");
    expect(context?.edges[0]).toMatchObject({ from: "a", to: "b" });
  });
  it("形状选中时读取其未单独选中的绑定文本", () => {
    const items = [rectangle("box"), element({ id: "label", type: "text", x: 0, y: 0, width: 30, height: 20, text: "绑定标签", containerId: "box" })];
    const context = extractSelectionContext(items, { box: true });
    expect(context?.nodes[0]?.label).toBe("绑定标签");
  });
  it("只处理前 50 个选中元素", () => {
    const items = Array.from({ length: 60 }, (_, index) => rectangle(String(index), index, 0));
    const context = extractSelectionContext(items, Object.fromEntries(items.map((item) => [item.id, true])));
    expect(context?.elementCount).toBe(50);
  });
  it("生成横向和纵向摘要", () => {
    const horizontal = extractSelectionContext([rectangle("a", 0, 0), rectangle("b", 200, 0)], { a: true, b: true });
    const vertical = extractSelectionContext([rectangle("a", 0, 0), rectangle("b", 0, 200)], { a: true, b: true });
    expect(horizontal?.summary).toContain("横向");
    expect(vertical?.summary).toContain("纵向");
  });
});
