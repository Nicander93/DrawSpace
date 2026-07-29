import { beforeEach, describe, expect, test } from "vitest";
import type { CanvasDocument } from "@shared/types";
import { useEditorStore } from "./editorStore";

const documents: CanvasDocument[] = [
  { id: "a", workspaceId: "w", name: "A", relativePath: "A.excalidraw", extension: ".excalidraw", fileSize: 0, isFavorite: false, isDeleted: false, createdAt: 1, modifiedAt: 1, lastOpenedAt: 1, contentHash: null, thumbnailPath: null, syncStatus: "local" },
  { id: "b", workspaceId: "w", name: "B", relativePath: "B.excalidraw", extension: ".excalidraw", fileSize: 0, isFavorite: false, isDeleted: false, createdAt: 2, modifiedAt: 2, lastOpenedAt: 2, contentHash: null, thumbnailPath: null, syncStatus: "local" },
  { id: "c", workspaceId: "w", name: "C", relativePath: "C.excalidraw", extension: ".excalidraw", fileSize: 0, isFavorite: false, isDeleted: false, createdAt: 3, modifiedAt: 3, lastOpenedAt: 3, contentHash: null, thumbnailPath: null, syncStatus: "local" }
];

beforeEach(() => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
  useEditorStore.setState({ tabs: [], activeDocumentId: null });
});

describe("editorStore", () => {
  test("opens, activates, reorders, and closes tabs while selecting a neighbor", () => {
    const store = useEditorStore.getState();
    for (const document of documents) store.openDocument({ documentId: document.id, name: document.name, relativePath: document.relativePath, isFavorite: document.isFavorite });

    store.activateDocument("b");
    store.reorderTabs(2, 0);
    expect(useEditorStore.getState().tabs.map((tab) => tab.documentId)).toEqual(["c", "a", "b"]);

    store.closeDocument("b");
    expect(useEditorStore.getState().activeDocumentId).toBe("a");
    store.closeDocument("a");
    expect(useEditorStore.getState().activeDocumentId).toBe("c");
    store.closeDocument("c");
    expect(useEditorStore.getState().activeDocumentId).toBeNull();
  });

  test("hydrates persisted tab order and drops missing documents", () => {
    localStorage.setItem("canvasdesk-editor-tabs", JSON.stringify({
      openDocumentIds: ["c", "missing", "a"],
      tabOrder: ["c", "missing", "a"],
      activeDocumentId: "c"
    }));

    useEditorStore.getState().hydrate(documents);
    expect(useEditorStore.getState().tabs.map((tab) => tab.documentId)).toEqual(["c", "a"]);
    expect(useEditorStore.getState().activeDocumentId).toBe("c");
  });

  test("does not duplicate a document and isolates metadata and save status", () => {
    const store = useEditorStore.getState();
    store.openDocument({ documentId: "a", name: "A", relativePath: "A.excalidraw", isFavorite: false });
    store.openDocument({ documentId: "a", name: "A updated", relativePath: "A.excalidraw", isFavorite: true });
    store.openDocument({ documentId: "b", name: "B", relativePath: "B.excalidraw", isFavorite: false });

    expect(useEditorStore.getState().tabs).toHaveLength(2);
    store.updateDocumentMetadata({ documentId: "a", name: "Renamed", relativePath: "folder/Renamed.excalidraw", isFavorite: true });
    store.updateSaveStatus("a", "dirty");

    const tabs = useEditorStore.getState().tabs;
    expect(tabs.find((tab) => tab.documentId === "a")).toMatchObject({ name: "Renamed", saveStatus: "dirty" });
    expect(tabs.find((tab) => tab.documentId === "b")).toMatchObject({ name: "B", saveStatus: "saved" });
  });

  test("replaces a conflicted document id while preserving the active tab slot", () => {
    const store = useEditorStore.getState();
    store.openDocument({ documentId: "a", name: "A", relativePath: "A.excalidraw", isFavorite: false });
    store.replaceDocumentId("a", { documentId: "a-conflict", name: "A (冲突副本)", relativePath: "A (冲突副本).excalidraw", isFavorite: false }, "error", "保存失败");

    expect(useEditorStore.getState().activeDocumentId).toBe("a-conflict");
    expect(useEditorStore.getState().tabs).toHaveLength(1);
    expect(useEditorStore.getState().tabs[0]).toMatchObject({ documentId: "a-conflict", saveStatus: "error", saveError: "保存失败" });
  });
});
