import { create } from "zustand";
import type { CanvasDocument } from "@shared/types";

export type EditorSaveStatus = "saved" | "saving" | "dirty" | "error" | "conflict";

export interface EditorTab {
  documentId: string;
  name: string;
  relativePath: string;
  isFavorite: boolean;
  isDraft: boolean;
  saveStatus: EditorSaveStatus;
  saveError: string | null;
  openedAt: number;
}

interface PersistedEditorState {
  openDocumentIds: string[];
  activeDocumentId: string | null;
  tabOrder: string[];
}

interface EditorState {
  tabs: EditorTab[];
  activeDocumentId: string | null;
  openDocument(document: Pick<EditorTab, "documentId" | "name" | "relativePath" | "isFavorite"> & Partial<Pick<EditorTab, "isDraft">>): void;
  activateDocument(documentId: string): void;
  closeDocument(documentId: string): void;
  reorderTabs(fromIndex: number, toIndex: number): void;
  replaceDocumentId(documentId: string, replacement: Pick<EditorTab, "documentId" | "name" | "relativePath" | "isFavorite">, saveStatus?: EditorSaveStatus, saveError?: string | null): void;
  updateDocumentMetadata(document: Pick<EditorTab, "documentId" | "name" | "relativePath" | "isFavorite">): void;
  updateSaveStatus(documentId: string, status: EditorSaveStatus, error?: string | null): void;
  updateDraftStatus(documentId: string, isDraft: boolean): void;
  hydrate(documents: CanvasDocument[]): void;
}

const STORAGE_KEY = "drawspace-editor-tabs";

const persist = (tabs: EditorTab[], activeDocumentId: string | null): void => {
  const value: PersistedEditorState = {
    openDocumentIds: tabs.map((tab) => tab.documentId),
    activeDocumentId,
    tabOrder: tabs.map((tab) => tab.documentId)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeDocumentId: null,

  openDocument: (document) => {
    const existing = get().tabs.find((tab) => tab.documentId === document.documentId);
    if (existing) {
      const tabs = document.isDraft
        ? get().tabs.map((tab) => tab.documentId === document.documentId ? { ...tab, isDraft: true } : tab)
        : get().tabs;
      set({ tabs, activeDocumentId: document.documentId });
      persist(get().tabs, document.documentId);
      return;
    }
    const tab: EditorTab = {
      ...document,
      isDraft: document.isDraft ?? false,
      saveStatus: "saved",
      saveError: null,
      openedAt: Date.now()
    };
    const tabs = [...get().tabs, tab];
    set({ tabs, activeDocumentId: document.documentId });
    persist(tabs, document.documentId);
  },

  activateDocument: (documentId) => {
    if (!get().tabs.some((tab) => tab.documentId === documentId)) return;
    set({ activeDocumentId: documentId });
    persist(get().tabs, documentId);
  },

  closeDocument: (documentId) => {
    const tabs = get().tabs.filter((tab) => tab.documentId !== documentId);
    const current = get().activeDocumentId;
    let activeDocumentId = current === documentId ? null : current;
    if (!activeDocumentId && tabs.length > 0) {
      const oldIndex = get().tabs.findIndex((tab) => tab.documentId === documentId);
      const nextTab = tabs[Math.min(Math.max(oldIndex, 0), tabs.length - 1)];
      activeDocumentId = nextTab?.documentId ?? null;
    }
    set({ tabs, activeDocumentId });
    persist(tabs, activeDocumentId);
  },

  reorderTabs: (fromIndex, toIndex) => {
    const tabs = [...get().tabs];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= tabs.length || toIndex >= tabs.length) return;
    const [tab] = tabs.splice(fromIndex, 1);
    if (!tab) return;
    tabs.splice(toIndex, 0, tab);
    set({ tabs });
    persist(tabs, get().activeDocumentId);
  },

  replaceDocumentId: (documentId, replacement, saveStatus = "conflict", saveError = null) => {
    const tabs = get().tabs.map((tab) => tab.documentId === documentId
      ? { ...tab, ...replacement, saveStatus, saveError }
      : tab);
    const activeDocumentId = get().activeDocumentId === documentId
      ? replacement.documentId
      : get().activeDocumentId;
    set({ tabs, activeDocumentId });
    persist(tabs, activeDocumentId);
  },

  updateDocumentMetadata: (document) => {
    const tabs = get().tabs.map((tab) =>
      tab.documentId === document.documentId ? { ...tab, ...document } : tab
    );
    set({ tabs });
    persist(tabs, get().activeDocumentId);
  },

  updateSaveStatus: (documentId, saveStatus, saveError = null) =>
    set({
      tabs: get().tabs.map((tab) =>
        tab.documentId === documentId ? { ...tab, saveStatus, saveError } : tab
      )
    }),

  updateDraftStatus: (documentId, isDraft) =>
    set({
      tabs: get().tabs.map((tab) =>
        tab.documentId === documentId ? { ...tab, isDraft } : tab
      )
    }),

  hydrate: (documents) => {
    if (get().tabs.length > 0) return;
    try {
      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as PersistedEditorState | null;
      if (!persisted?.tabOrder?.length) return;
      const byId = new Map(documents.map((document) => [document.id, document]));
      const tabs = persisted.tabOrder.flatMap((id) => {
        const document = byId.get(id);
        return document ? [{
          documentId: document.id,
          name: document.name,
          relativePath: document.relativePath,
          isFavorite: document.isFavorite,
          isDraft: false,
          saveStatus: "saved" as const,
          saveError: null,
          openedAt: Date.now()
        }] : [];
      });
      const activeDocumentId = tabs.some((tab) => tab.documentId === persisted.activeDocumentId)
        ? persisted.activeDocumentId
        : tabs[0]?.documentId ?? null;
      set({ tabs, activeDocumentId });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}));
