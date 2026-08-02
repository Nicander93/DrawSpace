import type { AiImageUpload, AiSelectionContext } from "@shared/types";
import type { ConvertedMermaidDiagram } from "./MermaidDiagramAdapter";

export interface AiCanvasBridge {
  documentId: string;
  getSelectionContext(): AiSelectionContext | undefined;
  exportSelectionPreview?(): Promise<AiImageUpload | undefined>;
  insertDiagram(diagram: ConvertedMermaidDiagram): void;
}
