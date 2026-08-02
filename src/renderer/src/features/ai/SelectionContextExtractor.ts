import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AiSelectionContext, AiSelectionEdge, AiSelectionNode } from "@shared/types";

type ElementWithBindings = ExcalidrawElement & {
  containerId?: string | null;
  text?: string;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  type: string;
};

const NODE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "frame"]);

export function extractSelectionContext(
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, boolean>>
): AiSelectionContext | undefined {
  const selected = elements.filter((element) => selectedElementIds[element.id]).slice(0, 50) as ElementWithBindings[];
  if (!selected.length) return undefined;
  const selectedIds = new Set(selected.map((element) => element.id));
  const textByContainer = new Map<string, string>();
  for (const element of elements as ElementWithBindings[]) {
    if (element.type === "text" && element.containerId && element.text?.trim()) {
      textByContainer.set(element.containerId, element.text.trim());
    }
    if (selectedIds.has(element.id) && element.type === "text" && element.text?.trim()) {
      textByContainer.set(element.id, element.text.trim());
    }
  }
  const nodes: AiSelectionNode[] = selected
    .filter((element) => NODE_TYPES.has(element.type))
    .map((element) => ({
      id: element.id,
      label: (element.type === "text" ? element.text : textByContainer.get(element.id) ?? element.text ?? element.id)?.trim() || element.id,
      elementType: element.type
    }));
  const edges: AiSelectionEdge[] = selected
    .filter((element) => element.type === "arrow" || element.type === "line")
    .map((element) => ({
      from: element.startBinding && selectedIds.has(element.startBinding.elementId) ? element.startBinding.elementId : undefined,
      to: element.endBinding && selectedIds.has(element.endBinding.elementId) ? element.endBinding.elementId : undefined,
      label: element.text?.trim() || undefined
    }))
    .filter((edge) => edge.from || edge.to);
  const bounds = selected.reduce(
    (current, element) => ({
      minX: Math.min(current.minX, element.x),
      minY: Math.min(current.minY, element.y),
      maxX: Math.max(current.maxX, element.x + element.width),
      maxY: Math.max(current.maxY, element.y + element.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  const orientation = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY ? "横向" : "纵向";
  const summary = `选中了 ${selected.length} 个元素，布局方向为${orientation}。节点：${nodes.map((node) => node.label).join("、") || "无"}。关系：${edges.length} 条。`.slice(0, 6_000);
  return { summary, nodes, edges, elementCount: selected.length };
}
