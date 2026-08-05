import { useSyncExternalStore } from "react";
import { aiCanvasRegistry } from "./AiCanvasRegistry";

export const useAiCanvasBridge = (documentId?: string) =>
  useSyncExternalStore(
    (listener) => aiCanvasRegistry.subscribe(listener),
    () => aiCanvasRegistry.get(documentId),
    () => undefined
  );
