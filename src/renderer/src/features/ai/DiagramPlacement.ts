import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type DiagramPlacementMode = "insert" | "replace";

const getBounds = (elements: readonly ExcalidrawElement[]): [number, number, number, number] => {
  const bounds = elements.reduce(
    (result, element) => ({
      minX: Math.min(result.minX, element.x),
      minY: Math.min(result.minY, element.y),
      maxX: Math.max(result.maxX, element.x + element.width),
      maxY: Math.max(result.maxY, element.y + element.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
};

export function placeGeneratedDiagram(
  elements: readonly ExcalidrawElement[],
  currentElements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, boolean>>,
  mode: DiagramPlacementMode = "insert"
): readonly ExcalidrawElement[] {
  if (!elements.length) return [];
  const [diagramMinX, diagramMinY] = getBounds(elements);
  const selected = currentElements.filter((element) => selectedElementIds[element.id]);

  if (mode === "replace") {
    if (!selected.length) throw new Error("当前没有可替换的选区");
    const [targetX, targetY] = getBounds(selected);
    const dx = targetX - diagramMinX;
    const dy = targetY - diagramMinY;
    return elements.map((element) => ({ ...element, x: element.x + dx, y: element.y + dy }));
  }

  const reference = selected.length ? selected : currentElements;
  const gap = 80;
  const targetX = reference.length ? getBounds(reference)[2] + gap : 0;
  const targetY = reference.length ? getBounds(reference)[1] : 0;
  const dx = targetX - diagramMinX;
  const dy = targetY - diagramMinY;
  return elements.map((element) => ({ ...element, x: element.x + dx, y: element.y + dy }));
}
