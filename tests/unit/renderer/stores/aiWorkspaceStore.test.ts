import { beforeEach, describe, expect, it } from "vitest";
import { useAiWorkspaceStore } from "../../../../src/renderer/src/stores/aiWorkspaceStore";

describe("aiWorkspaceStore", () => {
  beforeEach(() => {
    useAiWorkspaceStore.setState({
      panelOpen: false,
      activeSessionIdByWorkspace: {},
      canvasSnapshots: {}
    });
  });

  it("keeps panel and active session state in one store", () => {
    const state = useAiWorkspaceStore.getState();
    state.openPanel();
    state.setActiveSession("workspace-1", "session-1");

    expect(useAiWorkspaceStore.getState().panelOpen).toBe(true);
    expect(useAiWorkspaceStore.getState().activeSessionIdByWorkspace["workspace-1"]).toBe("session-1");
  });

  it("updates a document snapshot without storing Excalidraw objects", () => {
    useAiWorkspaceStore.getState().updateCanvasSnapshot("document-1", {
      documentId: "document-1",
      selectedElementCount: 2,
      hasSelection: true
    });

    expect(useAiWorkspaceStore.getState().canvasSnapshots["document-1"]).toEqual({
      documentId: "document-1",
      selectedElementCount: 2,
      hasSelection: true
    });
  });
});
