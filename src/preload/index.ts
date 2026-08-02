import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@shared/channels";
import type { AppCloseResponse, DesktopApi } from "@shared/types";

const desktopApi: DesktopApi = {
  workspace: {
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetActive),
    choose: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceChoose),
    rescan: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceRescan),
    listDirectories: () =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceListDirectories),
    createDirectory: (relativeDirectory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.workspaceCreateDirectory,
        relativeDirectory
      ),
    onIndexChanged: (listener) => {
      const handler = (): void => listener();
      ipcRenderer.on(IPC_CHANNELS.workspaceIndexChanged, handler);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.workspaceIndexChanged, handler);
    }
  },
  documents: {
    list: (query) => ipcRenderer.invoke(IPC_CHANNELS.documentsList, query),
    create: (relativeDirectory) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCreate, relativeDirectory),
    open: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpen, documentId),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.documentsSave, input),
    rename: (documentId, name) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsRename, documentId, name),
    move: (documentId, relativeDirectory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsMove,
        documentId,
        relativeDirectory
      ),
    copy: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCopy, documentId),
    toggleFavorite: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsToggleFavorite, documentId),
    trash: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsTrash, documentId),
    hasRestoreConflict: (documentId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsHasRestoreConflict,
        documentId
      ),
    restore: (documentId, conflictStrategy) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsRestore,
        documentId,
        conflictStrategy
      ),
    deletePermanently: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDeletePermanently, documentId),
    emptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.documentsEmptyTrash),
    reveal: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsReveal, documentId),
    importFromDialog: () =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsImportDialog),
    importBuffer: (fileName, data) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsImportBuffer, fileName, data),
    exportFile: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsExportFile, documentId),
    exportAsset: (documentId, format, data) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsExportAsset,
        documentId,
        format,
        data
      ),
    saveThumbnail: (documentId, data) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsSaveThumbnail, documentId, data)
  },
  recovery: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.recoveryList),
    save: (snapshot) => ipcRenderer.invoke(IPC_CHANNELS.recoverySave, snapshot),
    restore: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.recoveryRestore, documentId),
    discard: (documentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.recoveryDiscard, documentId)
  },
  sessions: {
    close: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.sessionsClose, sessionId)
  },
  window: {
    minimize: () => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.windowMaximize),
    close: () => ipcRenderer.send(IPC_CHANNELS.windowClose)
  },
  lifecycle: {
    onCloseRequested: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, request: Parameters<typeof listener>[0]): void => listener(request);
      ipcRenderer.on(IPC_CHANNELS.appCloseRequested, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appCloseRequested, handler);
    },
    respondToClose: (response: AppCloseResponse) => ipcRenderer.send(IPC_CHANNELS.appCloseResponded, response)
  },
  ai: {
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.aiGetSettings),
    saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.aiSaveSettings, settings),
    testConnection: (settings) => ipcRenderer.invoke(IPC_CHANNELS.aiTestConnection, settings),
    generateMermaid: (request) => ipcRenderer.invoke(IPC_CHANNELS.aiGenerateMermaid, request),
    repairMermaid: (request) => ipcRenderer.invoke(IPC_CHANNELS.aiRepairMermaid, request)
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
