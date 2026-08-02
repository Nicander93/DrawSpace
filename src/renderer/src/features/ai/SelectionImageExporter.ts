import { exportToBlob } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AiImageUpload } from "@shared/types";

export async function exportSelectionPreview(
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, boolean>>,
  appState: AppState,
  files: BinaryFiles
): Promise<AiImageUpload | undefined> {
  const selected = elements.filter((element) => selectedElementIds[element.id] && !element.isDeleted) as readonly NonDeletedExcalidrawElement[];
  if (!selected.length) return undefined;
  const blob = await exportToBlob({
    elements: selected,
    appState: { ...appState, exportBackground: true, viewBackgroundColor: "#ffffff" },
    files,
    mimeType: "image/png",
    maxWidthOrHeight: 2048,
    exportPadding: 24
  });
  return { fileName: "selection-preview.png", mimeType: "image/png", data: await blob.arrayBuffer() };
}
