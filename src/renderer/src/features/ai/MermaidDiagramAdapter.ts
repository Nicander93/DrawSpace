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
    const result = await parseMermaidToExcalidraw(mermaid, { maxEdges: 300, maxTextSize: 50_000 });
    const elements = convertToExcalidrawElements(result.elements) as readonly ExcalidrawElement[];
    if (!elements.length) throw new Error("Mermaid 转换结果为空");
    const files = result.files ?? {};
    const svgElement = await exportToSvg({
      elements,
      appState: { viewBackgroundColor: "#ffffff", exportBackground: true } as AppState,
      files
    });
    return { elements, files, svg: new XMLSerializer().serializeToString(svgElement) };
  }
}
