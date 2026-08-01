/** 当前仅实现 local；后续可扩展其他存储后端 */
export type WorkspaceProviderType = "local";

export interface AppCloseRequest {
  requestId: string;
  reason: "window-close" | "app-quit";
}

export interface AppCloseResponse {
  requestId: string;
  decision: "proceed" | "cancel";
}

export interface Workspace {
  id: string;
  name: string;
  providerType: WorkspaceProviderType;
  rootPath: string;
  createdAt: number;
  lastOpenedAt: number;
  isActive: boolean;
  isAvailable: boolean;
}

export type DocumentSyncStatus = "local" | "conflict" | "error";

export interface CanvasDocument {
  id: string;
  workspaceId: string;
  name: string;
  relativePath: string;
  extension: ".excalidraw";
  fileSize: number;
  createdAt: number;
  modifiedAt: number;
  lastOpenedAt: number | null;
  isFavorite: boolean;
  isDeleted: boolean;
  contentHash: string | null;
  thumbnailPath: string | null;
  syncStatus: DocumentSyncStatus;
  deletedAt?: number | null;
  originalRelativePath?: string | null;
}

export interface DocumentContent {
  document: CanvasDocument;
  sceneData: ExcalidrawFile;
  version: string;
  sessionId: string;
}

export interface ExcalidrawFile {
  type: "excalidraw";
  version: number;
  source: string;
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export type DocumentFilter = "home" | "recent" | "favorites" | "all" | "trash";
export type DocumentSort =
  | "lastOpened"
  | "modified"
  | "nameAsc"
  | "nameDesc"
  | "created";
export type DocumentView = "grid" | "list";

export interface DocumentListQuery {
  filter: DocumentFilter;
  search?: string;
  sort?: DocumentSort;
  limit?: number;
  offset?: number;
}

export interface DocumentListResult {
  documents: CanvasDocument[];
  total: number;
}

export type SaveResult =
  | {
      status: "saved";
      document: CanvasDocument;
      version: string;
    }
  | {
      status: "conflict";
      conflictDocument: CanvasDocument;
      message: string;
    };

export interface SaveDocumentInput {
  documentId: string;
  sceneData: ExcalidrawFile;
  expectedVersion: string;
}

export interface RecoverySnapshot {
  documentId: string;
  sourcePath: string;
  savedAt: number;
  sourceModifiedAt: number;
  sceneData: ExcalidrawFile;
  sessionId: string;
}

export interface RecoveryItem extends RecoverySnapshot {
  documentName: string;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  lastWorkspaceId: string | null;
}

export interface OperationResult {
  success: boolean;
  message?: string;
}

export type AppErrorCode =
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_PERMISSION_DENIED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_INVALID"
  | "DOCUMENT_SAVE_FAILED"
  | "DOCUMENT_CONFLICT"
  | "DATABASE_ERROR"
  | "THUMBNAIL_FAILED"
  | "STORAGE_UNAVAILABLE";

export interface SerializedAppError {
  code: AppErrorCode;
  message: string;
  recoverable: boolean;
}

export interface DesktopApi {
  workspace: {
    getActive(): Promise<Workspace | null>;
    choose(): Promise<Workspace | null>;
    rescan(): Promise<DocumentListResult>;
    listDirectories(): Promise<string[]>;
    createDirectory(relativeDirectory: string): Promise<void>;
    onIndexChanged(listener: () => void): () => void;
  };
  documents: {
    list(query: DocumentListQuery): Promise<DocumentListResult>;
    create(relativeDirectory?: string): Promise<DocumentContent>;
    open(documentId: string): Promise<DocumentContent>;
    save(input: SaveDocumentInput): Promise<SaveResult>;
    rename(documentId: string, name: string): Promise<CanvasDocument>;
    move(documentId: string, relativeDirectory: string): Promise<CanvasDocument>;
    copy(documentId: string): Promise<CanvasDocument>;
    toggleFavorite(documentId: string): Promise<CanvasDocument>;
    trash(documentId: string): Promise<void>;
    hasRestoreConflict(documentId: string): Promise<boolean>;
    restore(
      documentId: string,
      conflictStrategy?: "rename" | "overwrite"
    ): Promise<CanvasDocument>;
    deletePermanently(documentId: string): Promise<void>;
    emptyTrash(): Promise<void>;
    reveal(documentId: string): Promise<void>;
    importFromDialog(): Promise<CanvasDocument[]>;
    importBuffer(fileName: string, data: ArrayBuffer): Promise<CanvasDocument>;
    exportFile(documentId: string): Promise<boolean>;
    exportAsset(
      documentId: string,
      format: "png" | "svg",
      data: ArrayBuffer | string
    ): Promise<boolean>;
    saveThumbnail(documentId: string, data: ArrayBuffer): Promise<void>;
  };
  recovery: {
    list(): Promise<RecoveryItem[]>;
    save(snapshot: RecoverySnapshot): Promise<void>;
    restore(documentId: string): Promise<DocumentContent>;
    discard(documentId: string): Promise<void>;
  };
  sessions: {
    close(sessionId: string): Promise<void>;
  };
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };
  lifecycle: {
    onCloseRequested(listener: (request: AppCloseRequest) => void): () => void;
    respondToClose(response: AppCloseResponse): void;
  };
}
