import { convertToExcalidrawElements, exportToSvg } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

export interface ConvertedMermaidDiagram {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
  svg: string;
}

export class MermaidDiagramAdapter {
  async convert(mermaid: string): Promise<ConvertedMermaidDiagram> {
    const result = await parseMermaidToExcalidraw(mermaid, { maxEdges: 200, maxTextSize: 20_000 });
    const elements = convertToExcalidrawElements(result.elements, { regenerateIds: true }) as readonly ExcalidrawElement[];
    if (!elements.length) throw new Error("生成的图表不包含任何元素");
    if (elements.length > 500) throw new Error("生成的图表元素过多，请缩小需求范围");
    const files = result.files ?? {};
    const svgElement = await exportToSvg({
      elements,
      appState: { viewBackgroundColor: "#ffffff", exportBackground: true } as AppState,
      files
    });
    return { elements, files, svg: new XMLSerializer().serializeToString(svgElement) };
  }
}
