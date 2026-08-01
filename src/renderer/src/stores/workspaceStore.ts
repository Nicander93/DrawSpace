import { create } from "zustand";
import type {
  CanvasDocument,
  DocumentFilter,
  DocumentSort,
  DocumentView,
  Workspace
} from "@shared/types";

interface WorkspaceState {
  workspace: Workspace | null;
  documents: CanvasDocument[];
  directories: string[];
  total: number;
  initialized: boolean;
  loading: boolean;
  scanning: boolean;
  error: string | null;
  filter: DocumentFilter;
  sort: DocumentSort;
  search: string;
  view: DocumentView;
  pageNum: number;
  pageSize: number;
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  anchorDocumentId: string | null;
  initialize(): Promise<void>;
  chooseWorkspace(): Promise<boolean>;
  refresh(): Promise<void>;
  rescan(): Promise<void>;
  setFilter(filter: DocumentFilter): void;
  setSort(sort: DocumentSort): void;
  setSearch(search: string): void;
  setView(view: DocumentView): void;
  setPageNum(pageNum: number): void;
  setSelectedDocumentId(documentId: string | null): void;
  selectDocument(documentId: string, mode?: "replace" | "toggle" | "range"): void;
  selectAllDocuments(): void;
}

export function getNextSelectedDocumentIds(
  documents: CanvasDocument[],
  selectedDocumentIds: string[],
  anchorDocumentId: string | null,
  documentId: string,
  mode: "replace" | "toggle" | "range"
): string[] {
  if (mode === "toggle") {
    return selectedDocumentIds.includes(documentId)
      ? selectedDocumentIds.filter((id) => id !== documentId)
      : [...selectedDocumentIds, documentId];
  }
  if (mode === "range" && anchorDocumentId) {
    const from = documents.findIndex((document) => document.id === anchorDocumentId);
    const to = documents.findIndex((document) => document.id === documentId);
    if (from >= 0 && to >= 0) {
      return documents.slice(Math.min(from, to), Math.max(from, to) + 1).map((document) => document.id);
    }
  }
  return [documentId];
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "操作失败，请稍后重试";

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  documents: [],
  directories: [],
  total: 0,
  initialized: false,
  loading: false,
  scanning: false,
  error: null,
  filter: "home",
  sort: "modified",
  search: "",
  view: "grid",
  pageNum: 1,
  pageSize: 60,
  selectedDocumentId: null,
  selectedDocumentIds: [],
  anchorDocumentId: null,

  initialize: async () => {
    try {
      const workspace = await window.desktopApi.workspace.getActive();
      set({ workspace, initialized: true });
      if (workspace?.isAvailable) {
        await get().refresh();
      }
    } catch (error) {
      set({
        initialized: true,
        error: getErrorMessage(error)
      });
    }
  },

  chooseWorkspace: async () => {
    try {
      const workspace = await window.desktopApi.workspace.choose();
      if (!workspace) {
        return false;
      }
      set({
        workspace,
        filter: "home",
        selectedDocumentId: null,
        selectedDocumentIds: [],
        anchorDocumentId: null,
        search: "",
        error: null
      });
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: getErrorMessage(error) });
      return false;
    }
  },

  refresh: async () => {
    const { workspace, filter, search, sort, pageNum, pageSize } = get();
    if (!workspace?.isAvailable) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const [result, directories] = await Promise.all([
        window.desktopApi.documents.list({
          filter,
          search,
          sort,
          limit: filter === "recent" ? 20 : pageSize,
          offset: filter === "recent" ? 0 : (pageNum - 1) * pageSize
        }),
        window.desktopApi.workspace.listDirectories()
      ]);
      set({
        documents: result.documents,
        directories,
        total: result.total,
        loading: false
      });
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) });
    }
  },

  rescan: async () => {
    set({ scanning: true, error: null });
    try {
      await window.desktopApi.workspace.rescan();
      await get().refresh();
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ scanning: false });
    }
  },

  setFilter: (filter) => {
    const sort = filter === "recent" ? "lastOpened" : get().sort;
    set({ filter, sort, pageNum: 1, selectedDocumentId: null, selectedDocumentIds: [], anchorDocumentId: null });
    void get().refresh();
  },
  setSort: (sort) => {
    set({ sort, pageNum: 1 });
    void get().refresh();
  },
  setSearch: (search) => {
    set({ search, pageNum: 1 });
  },
  setView: (view) => set({ view }),
  setPageNum: (pageNum) => {
    set({ pageNum, selectedDocumentId: null, selectedDocumentIds: [], anchorDocumentId: null });
    void get().refresh();
  },
  setSelectedDocumentId: (selectedDocumentId) => set({
    selectedDocumentId,
    selectedDocumentIds: selectedDocumentId ? [selectedDocumentId] : [],
    anchorDocumentId: selectedDocumentId
  }),
  selectDocument: (documentId, mode = "replace") => {
    const { documents, selectedDocumentIds, anchorDocumentId } = get();
    const nextIds = getNextSelectedDocumentIds(documents, selectedDocumentIds, anchorDocumentId, documentId, mode);
    set({ selectedDocumentId: nextIds.at(-1) ?? null, selectedDocumentIds: nextIds, anchorDocumentId: mode === "replace" ? documentId : anchorDocumentId ?? documentId });
  },
  selectAllDocuments: () => set((state) => ({
    selectedDocumentId: state.documents.at(-1)?.id ?? null,
    selectedDocumentIds: state.documents.map((document) => document.id),
    anchorDocumentId: state.documents[0]?.id ?? null
  }))
}));
