import type { AiImageUpload, AiSelectionContext } from "@shared/types";
import type { ConvertedMermaidDiagram } from "./MermaidDiagramAdapter";
import type { DiagramPlacementMode } from "./DiagramPlacement";

export interface AiInsertDiagramOptions {
  mode?: DiagramPlacementMode;
}

export interface AiCanvasBridge {
  documentId: string;
  getSelectionContext(): AiSelectionContext | undefined;
  exportSelectionPreview?(): Promise<AiImageUpload | undefined>;
  insertDiagram(diagram: ConvertedMermaidDiagram, options?: AiInsertDiagramOptions): void;
}
