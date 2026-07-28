import { createHash } from "node:crypto";
import { basename, posix } from "node:path";
import { excalidrawFileSchema } from "@shared/schemas";
import type {
  CanvasDocument,
  DocumentContent,
  DocumentListQuery,
  DocumentListResult,
  ExcalidrawFile,
  RecoverySnapshot,
  SaveDocumentInput,
  SaveResult
} from "@shared/types";
import { DatabaseService } from "../database/DatabaseService";
import type { StorageEntry } from "../storage/StorageProvider";
import { RecoveryService } from "./RecoveryService";
import { ThumbnailService } from "./ThumbnailService";
import { WorkspaceService } from "./WorkspaceService";
import type { AppLogger } from "./AppLogger";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const hashData = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

const serializeScene = (sceneData: ExcalidrawFile): Uint8Array =>
  textEncoder.encode(JSON.stringify(sceneData, null, 2));

const formatDateTime = (date = new Date()): string => {
  const twoDigits = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(
    date.getDate()
  )} ${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}`;
};

const formatFileTimestamp = (date = new Date()): string =>
  `${formatDateTime(date)}${String(date.getSeconds()).padStart(2, "0")}`;

const buildVersion = (entry: StorageEntry, contentHash: string): string =>
  `${entry.modifiedAt ?? 0}:${entry.size ?? 0}:${contentHash}`;

export class DocumentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly workspaceService: WorkspaceService,
    private readonly recoveryService: RecoveryService,
    private readonly thumbnailService: ThumbnailService,
    private readonly logger?: AppLogger
  ) {}

  list(query: DocumentListQuery): DocumentListResult {
    const workspace = this.workspaceService.requireActiveWorkspace();
    return this.database.listDocuments(workspace.id, query);
  }

  getDocument(documentId: string): CanvasDocument {
    return this.requireDocument(documentId);
  }

  async create(relativeDirectory = ""): Promise<DocumentContent> {
    const workspace = this.workspaceService.requireActiveWorkspace();
    const provider = this.workspaceService.getStorageProvider();
    const defaultName = `未命名画布 ${formatDateTime()}`;
    const relativePath = await this.getAvailablePath(
      relativeDirectory,
      defaultName,
      ".excalidraw"
    );
    const sceneData = this.createEmptyScene();
    const fileData = serializeScene(sceneData);
    await provider.write(relativePath, fileData);
    const fileStat = await this.requireStat(relativePath);
    const contentHash = hashData(fileData);
    const document = this.database.upsertScannedDocument({
      workspaceId: workspace.id,
      name: basename(relativePath, ".excalidraw"),
      relativePath,
      fileSize: fileStat.size ?? fileData.byteLength,
      createdAt: fileStat.createdAt ?? Date.now(),
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash
    });
    return this.open(document.id);
  }

  async open(documentId: string): Promise<DocumentContent> {
    const document = this.requireDocument(documentId);
    if (document.isDeleted) {
      throw new Error("请先从回收站恢复该画布");
    }
    const provider = this.workspaceService.getStorageProvider();
    const fileData = await provider.read(document.relativePath);
    const sceneData = this.parseScene(fileData);
    this.logger?.info("document.open", { documentId });
    const fileStat = await this.requireStat(document.relativePath);
    const contentHash = hashData(fileData);
    const openedDocument = this.database.markOpened(documentId);
    this.database.updateDocumentFile({
      documentId,
      fileSize: fileStat.size ?? fileData.byteLength,
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash
    });
    return {
      document: openedDocument,
      sceneData,
      version: buildVersion(fileStat, contentHash),
      sessionId: this.database.startSession(documentId)
    };
  }

  async save(input: SaveDocumentInput): Promise<SaveResult> {
    const document = this.requireDocument(input.documentId);
    const provider = this.workspaceService.getStorageProvider();
    const currentData = await provider.read(document.relativePath);
    const currentStat = await this.requireStat(document.relativePath);
    const currentHash = hashData(currentData);
    const currentVersion = buildVersion(currentStat, currentHash);

    if (currentVersion !== input.expectedVersion) {
      this.logger?.warn("document.conflict", { documentId: document.id });
      return this.createConflictCopy(document, input.sceneData);
    }

    const fileData = serializeScene(input.sceneData);
    try {
      await provider.write(document.relativePath, fileData, {
        expectedVersion: currentStat.version
      });
    } catch (error) {
      if ((error as Error).message.includes("外部修改")) {
        return this.createConflictCopy(document, input.sceneData);
      }
      throw error;
    }

    const savedStat = await this.requireStat(document.relativePath);
    const contentHash = hashData(fileData);
    const savedDocument = this.database.updateDocumentFile({
      documentId: document.id,
      fileSize: savedStat.size ?? fileData.byteLength,
      modifiedAt: savedStat.modifiedAt ?? Date.now(),
      contentHash
    });
    await this.recoveryService.discard(document.id);
    this.logger?.info("document.save.success", { documentId: document.id });
    return {
      status: "saved",
      document: savedDocument,
      version: buildVersion(savedStat, contentHash)
    };
  }

  async rename(documentId: string, requestedName: string): Promise<CanvasDocument> {
    const document = this.requireDocument(documentId);
    const provider = this.workspaceService.getStorageProvider();
    const nextName = requestedName.replace(/\.excalidraw$/i, "");
    const relativeDirectory = posix.dirname(document.relativePath);
    const targetPath = await this.getAvailablePath(
      relativeDirectory === "." ? "" : relativeDirectory,
      nextName,
      ".excalidraw",
      document.relativePath
    );
    await provider.move(document.relativePath, targetPath);
    const fileStat = await this.requireStat(targetPath);
    return this.database.updateDocumentPath(
      documentId,
      nextName,
      targetPath,
      fileStat.modifiedAt ?? Date.now()
    );
  }

  async move(documentId: string, relativeDirectory: string): Promise<CanvasDocument> {
    const document = this.requireDocument(documentId);
    const provider = this.workspaceService.getStorageProvider();
    const targetPath = await this.getAvailablePath(
      relativeDirectory,
      document.name,
      ".excalidraw",
      document.relativePath
    );
    await provider.createDirectory(relativeDirectory);
    await provider.move(document.relativePath, targetPath);
    const fileStat = await this.requireStat(targetPath);
    return this.database.updateDocumentPath(
      documentId,
      document.name,
      targetPath,
      fileStat.modifiedAt ?? Date.now()
    );
  }

  async copy(documentId: string): Promise<CanvasDocument> {
    const workspace = this.workspaceService.requireActiveWorkspace();
    const document = this.requireDocument(documentId);
    const provider = this.workspaceService.getStorageProvider();
    const relativeDirectory = posix.dirname(document.relativePath);
    const targetPath = await this.getAvailablePath(
      relativeDirectory === "." ? "" : relativeDirectory,
      `${document.name} 副本`,
      ".excalidraw"
    );
    await provider.copy(document.relativePath, targetPath);
    const fileData = await provider.read(targetPath);
    const fileStat = await this.requireStat(targetPath);
    return this.database.upsertScannedDocument({
      workspaceId: workspace.id,
      name: basename(targetPath, ".excalidraw"),
      relativePath: targetPath,
      fileSize: fileStat.size ?? fileData.byteLength,
      createdAt: Date.now(),
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash: hashData(fileData)
    });
  }

  toggleFavorite(documentId: string): CanvasDocument {
    this.requireDocument(documentId);
    return this.database.toggleFavorite(documentId);
  }

  async trash(documentId: string): Promise<void> {
    const document = this.requireDocument(documentId);
    const provider = this.workspaceService.getStorageProvider();
    const trashPath = `.canvasdesk/trash/${document.id}-${basename(document.relativePath)}`;
    await provider.move(document.relativePath, trashPath);
    this.database.moveToTrash(document.id, document.relativePath, trashPath);
  }

  async hasRestoreConflict(documentId: string): Promise<boolean> {
    const document = this.requireDocument(documentId);
    if (!document.isDeleted || !document.originalRelativePath) {
      throw new Error("该画布不在回收站中");
    }
    return this.workspaceService
      .getStorageProvider()
      .exists(document.originalRelativePath);
  }

  async restore(
    documentId: string,
    conflictStrategy?: "rename" | "overwrite"
  ): Promise<CanvasDocument> {
    const document = this.requireDocument(documentId);
    if (!document.isDeleted || !document.originalRelativePath) {
      throw new Error("该画布不在回收站中");
    }
    const provider = this.workspaceService.getStorageProvider();
    const originalDirectory = posix.dirname(document.originalRelativePath);
    const hasConflict = await provider.exists(document.originalRelativePath);
    if (hasConflict && !conflictStrategy) {
      throw new Error("恢复位置已有同名文件，请选择重命名或覆盖");
    }
    let targetPath = document.originalRelativePath;
    if (hasConflict && conflictStrategy === "rename") {
      targetPath = await this.getAvailablePath(
        originalDirectory === "." ? "" : originalDirectory,
        basename(document.originalRelativePath, ".excalidraw"),
        ".excalidraw"
      );
    }
    if (hasConflict && conflictStrategy === "overwrite") {
      const conflictDocument = this.database.getDocumentByPath(
        document.workspaceId,
        document.originalRelativePath
      );
      await provider.delete(document.originalRelativePath);
      if (conflictDocument && conflictDocument.id !== document.id) {
        this.database.deleteDocument(conflictDocument.id);
        await this.thumbnailService.delete(conflictDocument.id);
      }
    }
    await provider.move(document.relativePath, targetPath);
    return this.database.restoreFromTrash(documentId, targetPath);
  }

  async deletePermanently(documentId: string): Promise<void> {
    const document = this.requireDocument(documentId);
    if (!document.isDeleted) {
      throw new Error("只能永久删除回收站中的画布");
    }
    await this.workspaceService.getStorageProvider().delete(document.relativePath);
    this.database.deleteDocument(documentId);
    await this.thumbnailService.delete(documentId);
    await this.recoveryService.discard(documentId);
  }

  async emptyTrash(): Promise<void> {
    const trashDocuments = this.list({
      filter: "trash",
      limit: 200,
      offset: 0
    }).documents;
    for (const document of trashDocuments) {
      await this.deletePermanently(document.id);
    }
  }

  async import(fileName: string, fileData: Uint8Array): Promise<CanvasDocument> {
    const workspace = this.workspaceService.requireActiveWorkspace();
    const sceneData = this.parseScene(fileData);
    const provider = this.workspaceService.getStorageProvider();
    const requestedName = basename(fileName).replace(/\.excalidraw$/i, "");
    const relativePath = await this.getAvailablePath(
      "",
      requestedName,
      ".excalidraw"
    );
    const normalizedData = serializeScene(sceneData);
    await provider.write(relativePath, normalizedData);
    const fileStat = await this.requireStat(relativePath);
    return this.database.upsertScannedDocument({
      workspaceId: workspace.id,
      name: basename(relativePath, ".excalidraw"),
      relativePath,
      fileSize: fileStat.size ?? normalizedData.byteLength,
      createdAt: fileStat.createdAt ?? Date.now(),
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash: hashData(normalizedData)
    });
  }

  async getFileData(documentId: string): Promise<Uint8Array> {
    const document = this.requireDocument(documentId);
    return this.workspaceService.getStorageProvider().read(document.relativePath);
  }

  async saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
    this.requireDocument(snapshot.documentId);
    await this.recoveryService.save(snapshot);
    this.logger?.warn("recovery.snapshot.saved", {
      documentId: snapshot.documentId
    });
  }

  async restoreRecovery(documentId: string): Promise<DocumentContent> {
    const sourceDocument = this.requireDocument(documentId);
    const snapshot = await this.recoveryService.get(documentId);
    const workspace = this.workspaceService.requireActiveWorkspace();
    const provider = this.workspaceService.getStorageProvider();
    const relativeDirectory = posix.dirname(sourceDocument.relativePath);
    const recoveryName = `${sourceDocument.name} (恢复副本 ${formatDateTime()})`;
    const relativePath = await this.getAvailablePath(
      relativeDirectory === "." ? "" : relativeDirectory,
      recoveryName,
      ".excalidraw"
    );
    const fileData = serializeScene(snapshot.sceneData);
    await provider.write(relativePath, fileData);
    const fileStat = await this.requireStat(relativePath);
    const document = this.database.upsertScannedDocument({
      workspaceId: workspace.id,
      name: recoveryName,
      relativePath,
      fileSize: fileStat.size ?? fileData.byteLength,
      createdAt: Date.now(),
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash: hashData(fileData)
    });
    await this.recoveryService.discard(documentId);
    return this.open(document.id);
  }

  closeSession(sessionId: string): void {
    this.database.closeSession(sessionId);
  }

  private createEmptyScene(): ExcalidrawFile {
    return {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [],
      appState: {
        viewBackgroundColor: "#f7f6f3",
        gridSize: null
      },
      files: {}
    };
  }

  private parseScene(fileData: Uint8Array): ExcalidrawFile {
    try {
      const parsedData = JSON.parse(textDecoder.decode(fileData)) as unknown;
      return excalidrawFileSchema.parse(parsedData);
    } catch {
      throw new Error("画布文件损坏或不是有效的 Excalidraw 文件");
    }
  }

  private async createConflictCopy(
    sourceDocument: CanvasDocument,
    sceneData: ExcalidrawFile
  ): Promise<SaveResult> {
    const workspace = this.workspaceService.requireActiveWorkspace();
    const provider = this.workspaceService.getStorageProvider();
    const relativeDirectory = posix.dirname(sourceDocument.relativePath);
    const conflictName = `${sourceDocument.name} (冲突副本 ${formatFileTimestamp()})`;
    const relativePath = await this.getAvailablePath(
      relativeDirectory === "." ? "" : relativeDirectory,
      conflictName,
      ".excalidraw"
    );
    const fileData = serializeScene(sceneData);
    await provider.write(relativePath, fileData);
    const fileStat = await this.requireStat(relativePath);
    const conflictDocument = this.database.upsertScannedDocument({
      workspaceId: workspace.id,
      name: conflictName,
      relativePath,
      fileSize: fileStat.size ?? fileData.byteLength,
      createdAt: Date.now(),
      modifiedAt: fileStat.modifiedAt ?? Date.now(),
      contentHash: hashData(fileData)
    });
    this.database.updateDocumentFile({
      documentId: conflictDocument.id,
      fileSize: conflictDocument.fileSize,
      modifiedAt: conflictDocument.modifiedAt,
      contentHash: conflictDocument.contentHash ?? "",
      syncStatus: "conflict"
    });
    return {
      status: "conflict",
      conflictDocument,
      message: "检测到外部修改，当前内容已另存为冲突副本"
    };
  }

  private async getAvailablePath(
    relativeDirectory: string,
    requestedName: string,
    extension: ".excalidraw",
    currentPath?: string
  ): Promise<string> {
    const provider = this.workspaceService.getStorageProvider();
    let suffix = 1;
    let relativePath = posix.join(relativeDirectory, `${requestedName}${extension}`);

    while (relativePath !== currentPath && (await provider.exists(relativePath))) {
      suffix += 1;
      relativePath = posix.join(
        relativeDirectory,
        `${requestedName} ${suffix}${extension}`
      );
    }
    return relativePath;
  }

  private requireDocument(documentId: string): CanvasDocument {
    const document = this.database.getDocument(documentId);
    if (!document) {
      throw new Error("找不到画布文件");
    }
    return document;
  }

  private async requireStat(relativePath: string): Promise<StorageEntry> {
    const fileStat = await this.workspaceService
      .getStorageProvider()
      .stat(relativePath);
    if (!fileStat) {
      throw new Error("找不到画布文件");
    }
    return fileStat;
  }
}
