import { describe, expect, it } from "vitest";
import type { CanvasDocument } from "@shared/types";
import { getNextSelectedDocumentIds } from "@renderer/stores/workspaceStore";


const documentOf = (id: string): CanvasDocument => ({
  id, workspaceId: "workspace", name: id, relativePath: `${id}.excalidraw`, extension: ".excalidraw",
  fileSize: 0, createdAt: 0, modifiedAt: 0, lastOpenedAt: null, isFavorite: false,
  isDeleted: false, contentHash: null, thumbnailPath: null, syncStatus: "local"
});

describe("workspace selection", () => {
  const documents = [documentOf("a"), documentOf("b"), documentOf("c")];

  it("supports toggle and range selection", () => {
    expect(getNextSelectedDocumentIds(documents, [], null, "a", "replace")).toEqual(["a"]);
    expect(getNextSelectedDocumentIds(documents, ["a"], "a", "c", "toggle")).toEqual(["a", "c"]);
    expect(getNextSelectedDocumentIds(documents, ["a"], "a", "c", "range")).toEqual(["a", "b", "c"]);
  });
});
