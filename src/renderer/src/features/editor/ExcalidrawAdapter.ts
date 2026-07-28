import {
  exportToBlob,
  exportToSvg,
  serializeAsJSON
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawFile } from "@shared/types";

export interface CanvasScene {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
}

export class ExcalidrawAdapter {
  toInitialData(sceneData: ExcalidrawFile) {
    return {
      elements: sceneData.elements as readonly ExcalidrawElement[],
      appState: sceneData.appState as Partial<AppState>,
      files: sceneData.files as BinaryFiles,
      scrollToContent: true
    };
  }

  fromScene(scene: CanvasScene): ExcalidrawFile {
    return JSON.parse(
      serializeAsJSON(
        scene.elements,
        scene.appState,
        scene.files,
        "local"
      )
    ) as ExcalidrawFile;
  }

  getScene(api: ExcalidrawImperativeAPI): CanvasScene {
    return {
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles()
    };
  }

  async renderThumbnail(scene: CanvasScene): Promise<Blob> {
    return exportToBlob({
      elements: scene.elements,
      appState: {
        ...scene.appState,
        exportBackground: true,
        exportWithDarkMode: false
      },
      files: scene.files,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => {
        const scale = Math.min(480 / Math.max(width, 1), 270 / Math.max(height, 1), 1);
        return {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          scale
        };
      }
    });
  }

  async exportPng(scene: CanvasScene): Promise<Blob> {
    return exportToBlob({
      elements: scene.elements,
      appState: {
        ...scene.appState,
        exportBackground: true
      },
      files: scene.files,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => ({
        width: width * 2,
        height: height * 2,
        scale: 2
      })
    });
  }

  async exportSvg(scene: CanvasScene): Promise<string> {
    const svg = await exportToSvg({
      elements: scene.elements,
      appState: {
        ...scene.appState,
        exportBackground: true
      },
      files: scene.files
    });
    return new XMLSerializer().serializeToString(svg);
  }
}
