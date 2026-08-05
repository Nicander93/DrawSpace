import { create } from "zustand";

export interface AiCanvasSnapshot {
  documentId: string;
  selectedElementCount: number;
  hasSelection: boolean;
}

interface AiWorkspaceState {
  panelOpen: boolean;
  activeSessionIdByWorkspace: Record<string, string | undefined>;
  canvasSnapshots: Record<string, AiCanvasSnapshot | undefined>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setActiveSession: (workspaceId: string, sessionId?: string) => void;
  updateCanvasSnapshot: (documentId: string, snapshot: AiCanvasSnapshot) => void;
  removeCanvasSnapshot: (documentId: string) => void;
}

export const useAiWorkspaceStore = create<AiWorkspaceState>((set) => ({
  panelOpen: false,
  activeSessionIdByWorkspace: {},
  canvasSnapshots: {},
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  setActiveSession: (workspaceId, sessionId) =>
    set((state) => ({
      activeSessionIdByWorkspace: {
        ...state.activeSessionIdByWorkspace,
        [workspaceId]: sessionId
      }
    })),
  updateCanvasSnapshot: (documentId, snapshot) =>
    set((state) => {
      const previous = state.canvasSnapshots[documentId];
      if (
        previous?.selectedElementCount === snapshot.selectedElementCount &&
        previous.hasSelection === snapshot.hasSelection
      ) {
        return state;
      }
      return {
        canvasSnapshots: { ...state.canvasSnapshots, [documentId]: snapshot }
      };
    }),
  removeCanvasSnapshot: (documentId) =>
    set((state) => {
      if (!state.canvasSnapshots[documentId]) return state;
      const snapshots = { ...state.canvasSnapshots };
      delete snapshots[documentId];
      return { canvasSnapshots: snapshots };
    })
}));
