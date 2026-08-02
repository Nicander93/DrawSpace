import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AiSelectionContext, AiSelectionEdge, AiSelectionNode } from "@shared/types";

type ElementWithBindings = ExcalidrawElement & {
  containerId?: string | null;
  text?: string;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  type: string;
};

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond", "frame"]);
const MAX_NODES = 50;
const MAX_EDGES = 100;
const truncate = (value: string, max = 500): string => value.trim().slice(0, max);

export function extractSelectionContext(
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, boolean>>
): AiSelectionContext | undefined {
  const selectedAll = elements.filter((element) => selectedElementIds[element.id]) as ElementWithBindings[];
  if (!selectedAll.length) return undefined;
  const selected = selectedAll.slice(0, 50);
  const selectedIds = new Set(selectedAll.map((element) => element.id));
  const textByContainer = new Map<string, string>();
  for (const element of elements as ElementWithBindings[]) {
    if (element.type === "text" && element.containerId && element.text?.trim()) {
      textByContainer.set(element.containerId, truncate(element.text));
    }
    if (selectedIds.has(element.id) && element.type === "text" && element.text?.trim()) {
      textByContainer.set(element.id, truncate(element.text));
    }
  }
  const selectedShapes = selected.filter((element) => SHAPE_TYPES.has(element.type));
  const shapeIds = new Set(selectedShapes.map((element) => element.id));
  const nodes: AiSelectionNode[] = [];
  const nodeBySourceId = new Map<string, AiSelectionNode>();
  for (const element of selectedShapes) {
    if (nodes.length >= MAX_NODES) break;
    const alias = `N${nodes.length + 1}`;
    const node: AiSelectionNode = {
      alias,
      sourceElementId: element.id,
      id: alias,
      label: truncate(textByContainer.get(element.id) ?? element.text ?? ""),
      elementType: element.type
    };
    nodes.push(node);
    nodeBySourceId.set(element.id, node);
  }
  for (const element of selected) {
    if (element.type !== "text" || (element.containerId && shapeIds.has(element.containerId))) continue;
    if (nodes.length >= MAX_NODES) break;
    const alias = `N${nodes.length + 1}`;
    const node: AiSelectionNode = { alias, sourceElementId: element.id, id: alias, label: truncate(element.text ?? ""), elementType: element.type };
    nodes.push(node);
    nodeBySourceId.set(element.id, node);
  }
  const edges: AiSelectionEdge[] = selected
    .filter((element) => element.type === "arrow")
    .slice(0, MAX_EDGES)
    .map((element) => ({
      fromAlias: element.startBinding && selectedIds.has(element.startBinding.elementId) ? nodeBySourceId.get(element.startBinding.elementId)?.alias : undefined,
      toAlias: element.endBinding && selectedIds.has(element.endBinding.elementId) ? nodeBySourceId.get(element.endBinding.elementId)?.alias : undefined,
      from: element.startBinding && selectedIds.has(element.startBinding.elementId) ? element.startBinding.elementId : undefined,
      to: element.endBinding && selectedIds.has(element.endBinding.elementId) ? element.endBinding.elementId : undefined,
      label: truncate(textByContainer.get(element.id) ?? element.text ?? "") || undefined
    }))
    .filter((edge) => edge.fromAlias || edge.toAlias);
  const bounds = selected.reduce(
    (current, element) => ({
      minX: Math.min(current.minX, element.x),
      minY: Math.min(current.minY, element.y),
      maxX: Math.max(current.maxX, element.x + element.width),
      maxY: Math.max(current.maxY, element.y + element.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const ratio = width / Math.max(height, 1);
  const layout = ratio >= 1.5 ? "horizontal" : ratio <= 0.67 ? "vertical" : "free";
  const layoutText = layout === "horizontal" ? "横向" : layout === "vertical" ? "纵向" : "自由";
  const summary = `选中了 ${selectedAll.length} 个元素，纳入 ${selected.length} 个元素，布局为${layoutText}。节点：${nodes.map((node) => node.label).filter(Boolean).join("、") || "无"}。关系：${edges.length} 条。`.slice(0, 6_000);
  return {
    summary,
    nodes,
    edges,
    elementCount: selected.length,
    selectedElementCount: selectedAll.length,
    includedElementCount: selected.length,
    truncated: selected.length < selectedAll.length || nodes.length >= MAX_NODES || edges.length >= MAX_EDGES,
    layout
  };
}
