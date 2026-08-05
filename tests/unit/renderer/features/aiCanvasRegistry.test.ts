import { describe, expect, it, vi } from "vitest";
import type { AiCanvasBridge } from "../../../../src/renderer/src/features/ai/AiCanvasBridge";
import { aiCanvasRegistry } from "../../../../src/renderer/src/features/ai/canvas/AiCanvasRegistry";

const bridge = (documentId: string): AiCanvasBridge => ({
  documentId,
  getSelectionContext: () => undefined,
  insertDiagram: () => undefined
});

describe("AiCanvasRegistry", () => {
  it("returns the registered bridge and removes it on cleanup", () => {
    const value = bridge("document-1");
    const dispose = aiCanvasRegistry.register(value.documentId, value);

    expect(aiCanvasRegistry.get("document-1")).toBe(value);
    dispose();
    expect(aiCanvasRegistry.get("document-1")).toBeUndefined();
  });

  it("notifies subscribers when a tab bridge changes", () => {
    const listener = vi.fn();
    const disposeSubscription = aiCanvasRegistry.subscribe(listener);
    const value = bridge("document-2");
    const disposeBridge = aiCanvasRegistry.register(value.documentId, value);

    expect(listener).toHaveBeenCalledTimes(1);
    disposeBridge();
    expect(listener).toHaveBeenCalledTimes(2);
    disposeSubscription();
  });
});
