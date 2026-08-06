import { create } from "zustand";

export interface AiCanvasSnapshot {
  documentId: string;
  selectedElementCount: number;
  hasSelection: boolean;
}

export type AiPanelView = "chat" | "settings";
export type AiPendingIntent = "upload" | "explain-selection" | null;

interface AiWorkspaceState {
  panelOpen: boolean;
  panelView: AiPanelView;
  pendingIntent: AiPendingIntent;
  activeSessionIdByWorkspace: Record<string, string | undefined>;
  canvasSnapshots: Record<string, AiCanvasSnapshot | undefined>;
  togglePanel: () => void;
  openPanel: (view?: AiPanelView, intent?: AiPendingIntent) => void;
  closePanel: () => void;
  setPanelView: (view: AiPanelView) => void;
  consumePendingIntent: () => AiPendingIntent;
  setActiveSession: (workspaceId: string, sessionId?: string) => void;
  updateCanvasSnapshot: (documentId: string, snapshot: AiCanvasSnapshot) => void;
  removeCanvasSnapshot: (documentId: string) => void;
}

export const useAiWorkspaceStore = create<AiWorkspaceState>((set, get) => ({
  panelOpen: false,
  panelView: "chat",
  pendingIntent: null,
  activeSessionIdByWorkspace: {},
  canvasSnapshots: {},
  togglePanel: () =>
    set((state) => ({
      panelOpen: !state.panelOpen,
      panelView: state.panelOpen ? state.panelView : "chat",
      pendingIntent: state.panelOpen ? null : state.pendingIntent
    })),
  openPanel: (view = "chat", intent = null) =>
    set({ panelOpen: true, panelView: view, pendingIntent: intent }),
  closePanel: () => set({ panelOpen: false, pendingIntent: null }),
  setPanelView: (view) => set({ panelView: view }),
  consumePendingIntent: () => {
    const intent = get().pendingIntent;
    if (intent) set({ pendingIntent: null });
    return intent;
  },
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
