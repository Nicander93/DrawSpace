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

export interface AiSettings {
  baseUrl: string;
  model: string;
  visionModel?: string;
  temperature: number;
  timeoutMs: number;
}

export interface AiConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  models?: string[];
}

export interface AiSelectionNode {
  alias: string;
  sourceElementId: string;
  id?: string;
  label: string;
  elementType: string;
}

export interface AiSelectionEdge {
  fromAlias?: string;
  toAlias?: string;
  from?: string;
  to?: string;
  label?: string;
}

export interface AiSelectionContext {
  summary: string;
  nodes: AiSelectionNode[];
  edges: AiSelectionEdge[];
  elementCount: number;
  selectedElementCount?: number;
  includedElementCount?: number;
  truncated?: boolean;
  layout?: "horizontal" | "vertical" | "free";
}

export type AiTurnMode =
  | "create"
  | "revise"
  | "recreate_image"
  | "reference_image"
  | "extend_selection";

export type AiTurnStatus = "generating" | "ready" | "error" | "cancelled";

export interface AiSessionSummary {
  id: string;
  workspaceId: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  title: string;
  draftPrompt: string;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  latestTurnStatus?: AiTurnStatus;
  latestPrompt?: string;
}

export interface AiAttachment {
  id: string;
  sessionId: string;
  turnId?: string;
  kind: "uploaded_image" | "selection_preview";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface AiImageUpload {
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: ArrayBuffer;
}

export interface AiContextSnapshot {
  documentId?: string;
  documentName?: string;
  selection?: AiSelectionContext;
  attachmentIds: string[];
  capturedAt: number;
}

export interface AiTurn {
  id: string;
  sessionId: string;
  baseTurnId?: string;
  mode: AiTurnMode;
  prompt: string;
  context?: AiContextSnapshot;
  status: AiTurnStatus;
  mermaid?: string;
  errorMessage?: string;
  modelName?: string;
  createdAt: number;
  completedAt?: number;
  insertedDocumentId?: string;
  insertedAt?: number;
  attachments: AiAttachment[];
}

export interface AiSessionDetail extends AiSessionSummary {
  turns: AiTurn[];
}

export interface CreateAiSessionRequest {
  workspaceId: string;
  sourceDocumentId?: string;
  title?: string;
}

export interface UpdateAiSessionRequest {
  sessionId: string;
  title?: string;
  draftPrompt?: string;
}

export interface GenerateAiTurnRequest {
  sessionId: string;
  prompt: string;
  mode: AiTurnMode;
  baseTurnId?: string;
  selection?: AiSelectionContext;
  images?: AiImageUpload[];
}

export interface RepairAiTurnRequest {
  sessionId: string;
  turnId: string;
  prompt: string;
  parseError: string;
  selection?: AiSelectionContext;
}

export interface GenerateMermaidRequest {
  prompt: string;
  selection?: AiSelectionContext;
}

export interface GenerateMermaidResult {
  mermaid: string;
  rawResponse: string;
}

export interface RepairMermaidRequest {
  prompt: string;
  mermaid: string;
  parseError: string;
  selection?: AiSelectionContext;
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
  ai: {
    getSettings(): Promise<AiSettings>;
    saveSettings(settings: AiSettings): Promise<AiSettings>;
    testConnection(settings?: AiSettings): Promise<AiConnectionTestResult>;
    generateMermaid(request: GenerateMermaidRequest): Promise<GenerateMermaidResult>;
    repairMermaid(request: RepairMermaidRequest): Promise<GenerateMermaidResult>;
    listSessions(workspaceId: string): Promise<AiSessionSummary[]>;
    createSession(request: CreateAiSessionRequest): Promise<AiSessionSummary>;
    getSession(sessionId: string): Promise<AiSessionDetail>;
    updateSession(request: UpdateAiSessionRequest): Promise<AiSessionSummary>;
    deleteSession(sessionId: string): Promise<void>;
    generateTurn(request: GenerateAiTurnRequest): Promise<AiTurn>;
    repairTurn(request: RepairAiTurnRequest): Promise<AiTurn>;
    onTurnUpdated(listener: (turn: AiTurn) => void): () => void;
    markTurnInserted(turnId: string, documentId: string): Promise<void>;
  };
}
