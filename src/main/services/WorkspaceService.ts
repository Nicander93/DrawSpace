import { createHash, randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import type { CanvasDocument, DocumentListResult, Workspace, WorkspaceProviderType } from "@shared/types";
import { DatabaseService } from "../database/DatabaseService";
import { LocalStorageProvider } from "../storage/LocalStorageProvider";
import type { StorageProvider, StorageWatchEvent } from "../storage/StorageProvider";
import type { AppLogger } from "./AppLogger";

interface WorkspaceMetadata {
  version: number;
  workspaceId: string;
  name: string;
  createdAt: string;
}

const decodeText = (data: Uint8Array): string => new TextDecoder().decode(data);
const encodeText = (data: string): Uint8Array => new TextEncoder().encode(data);
const hashData = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

export class WorkspaceService {
  private activeWorkspace: Workspace | null = null;
  private storageProvider: LocalStorageProvider | null = null;
  private stopWatcher: (() => Promise<void> | void) | null = null;
  private scanTimer: NodeJS.Timeout | null = null;
  private activeScan: Promise<DocumentListResult> | null = null;
  private readonly indexChangedListeners = new Set<() => void>();

  constructor(
    private readonly database: DatabaseService,
    private readonly logger?: AppLogger
  ) {}

  async initialize(): Promise<Workspace | null> {
    const activeWorkspace = this.database.getActiveWorkspace();
    if (!activeWorkspace) {
      return null;
    }

    const provider = new LocalStorageProvider(activeWorkspace.rootPath);
    const rootEntry = await provider.stat("");
    if (!rootEntry) {
      this.activeWorkspace = { ...activeWorkspace, isAvailable: false };
      return this.activeWorkspace;
    }

    this.activeWorkspace = activeWorkspace;
    this.storageProvider = provider;
    await this.startWatcher();
    void this.scan().catch((error) => {
      this.logger?.error("workspace.scan.failed", error);
    });
    return this.activeWorkspace;
  }

  getActiveWorkspace(): Workspace | null {
    return this.activeWorkspace;
  }

  requireActiveWorkspace(): Workspace {
    if (!this.activeWorkspace?.isAvailable) {
      throw new Error("当前工作区不可用，请重新选择目录");
    }
    return this.activeWorkspace;
  }

  getStorageProvider(): LocalStorageProvider {
    if (!this.storageProvider) {
      throw new Error("请先选择一个工作区");
    }
    return this.storageProvider;
  }

  async activate(
    rootPath: string,
    providerType: WorkspaceProviderType
  ): Promise<Workspace> {
    this.logger?.info("workspace.open.start", { providerType });
    await this.stopActiveWatcher();
    await this.activeScan?.catch(() => undefined);
    const provider = new LocalStorageProvider(rootPath);
    await provider.initialize();
    await provider.createDirectory(".canvasdesk/trash");

    let metadata: WorkspaceMetadata | null = null;
    if (await provider.exists(".canvasdesk/workspace.json")) {
      try {
        metadata = JSON.parse(
          decodeText(await provider.read(".canvasdesk/workspace.json"))
        ) as WorkspaceMetadata;
      } catch {
        metadata = null;
      }
    }

    if (!metadata) {
      metadata = {
        version: 1,
        workspaceId: randomUUID(),
        name: basename(rootPath),
        createdAt: new Date().toISOString()
      };
      await provider.write(
        ".canvasdesk/workspace.json",
        encodeText(JSON.stringify(metadata, null, 2))
      );
    }

    this.activeWorkspace = this.database.activateWorkspace({
      id: metadata.workspaceId,
      name: metadata.name || basename(rootPath),
      rootPath,
      providerType,
      createdAt: Date.parse(metadata.createdAt)
    });
    this.storageProvider = provider;
    await this.scan();
    await this.startWatcher();
    this.logger?.info("workspace.open.success", {
      workspaceId: this.activeWorkspace.id,
      providerType
    });
    return this.activeWorkspace;
  }

  scan(): Promise<DocumentListResult> {
    if (this.activeScan) {
      return this.activeScan;
    }
    this.activeScan = this.performScan().finally(() => {
      this.activeScan = null;
    });
    return this.activeScan;
  }

  private async performScan(): Promise<DocumentListResult> {
    const workspace = this.requireActiveWorkspace();
    const provider = this.getStorageProvider();
    this.logger?.info("workspace.scan.start", { workspaceId: workspace.id });
    const { entries } = await provider.list("", { recursive: true });
    const canvasEntries = entries.filter(
      (entry) =>
        entry.type === "file" && extname(entry.name).toLowerCase() === ".excalidraw"
    );
    const relativePaths = canvasEntries.map((entry) => entry.path);
    const activeRelativePaths = new Set(relativePaths);

    for (let index = 0; index < canvasEntries.length; index += 24) {
      const entryBatch = canvasEntries.slice(index, index + 24);
      await Promise.all(
        entryBatch.map(async (entry) => {
          try {
            const fileData = await provider.read(entry.path);
            this.database.upsertScannedDocument({
              workspaceId: workspace.id,
              name: basename(entry.name, ".excalidraw"),
              relativePath: entry.path,
              fileSize: entry.size ?? fileData.byteLength,
              createdAt: entry.createdAt ?? entry.modifiedAt ?? Date.now(),
              modifiedAt: entry.modifiedAt ?? Date.now(),
              contentHash: hashData(fileData)
            });
          } catch (error) {
            this.logger?.warn("workspace.scan.file-skipped", {
              reason:
                error instanceof Error ? error.message : "unknown read error"
            });
          }
        })
      );
    }

    const indexedDocuments = this.database.listDocuments(workspace.id, {
      filter: "all",
      limit: 100_000
    }).documents;
    await Promise.all(
      indexedDocuments.map(async (document) => {
        if (
          !activeRelativePaths.has(document.relativePath) &&
          (await provider.exists(document.relativePath))
        ) {
          activeRelativePaths.add(document.relativePath);
        }
      })
    );
    this.database.deleteMissingDocuments(workspace.id, [...activeRelativePaths]);
    this.logger?.info("workspace.scan.success", {
      workspaceId: workspace.id,
      documentCount: relativePaths.length
    });
    this.indexChangedListeners.forEach((listener) => listener());
    return this.database.listDocuments(workspace.id, {
      filter: "all",
      sort: "modified"
    });
  }

  resolveAbsolutePath(relativePath: string): string {
    return this.getStorageProvider().resolvePath(relativePath);
  }

  async listDirectories(): Promise<string[]> {
    const { entries } = await this.getStorageProvider().list("", {
      recursive: true
    });
    return entries
      .filter((entry) => entry.type === "directory")
      .map((entry) => entry.path)
      .sort((firstPath, secondPath) =>
        firstPath.localeCompare(secondPath, "zh-CN")
      );
  }

  async createDirectory(relativeDirectory: string): Promise<void> {
    await this.getStorageProvider().createDirectory(relativeDirectory);
    this.indexChangedListeners.forEach((listener) => listener());
  }

  onIndexChanged(listener: () => void): () => void {
    this.indexChangedListeners.add(listener);
    return () => this.indexChangedListeners.delete(listener);
  }

  private async startWatcher(): Promise<void> {
    const provider: StorageProvider = this.getStorageProvider();
    if (!provider.watch) {
      return;
    }
    const pendingPaths = new Map<string, StorageWatchEvent["type"]>();
    this.stopWatcher = await provider.watch("", (event) => {
      if (!event.path.toLowerCase().endsWith(".excalidraw")) {
        return;
      }
      if (basename(event.path).startsWith(".")) {
        return;
      }
      pendingPaths.set(event.path, event.type);
      if (this.scanTimer) {
        clearTimeout(this.scanTimer);
      }
      this.scanTimer = setTimeout(() => {
        const batch = [...pendingPaths.entries()];
        pendingPaths.clear();
        void this.applyWatchBatch(batch).catch((error) => {
          this.logger?.error("workspace.watch.failed", error);
        });
      }, 400);
    });
  }

  private async applyWatchBatch(
    batch: Array<[string, StorageWatchEvent["type"]]>
  ): Promise<void> {
    const workspace = this.activeWorkspace;
    if (!workspace?.isAvailable) {
      return;
    }
    const provider = this.getStorageProvider();
    let changed = false;

    for (const [relativePath, eventType] of batch) {
      if (eventType === "deleted") {
        const existing = this.database.getDocumentByPath(
          workspace.id,
          relativePath
        );
        if (existing && !existing.isDeleted) {
          this.database.deleteDocument(existing.id);
          changed = true;
        }
        continue;
      }

      try {
        const entry = await provider.stat(relativePath);
        if (!entry || entry.type !== "file") {
          continue;
        }
        const fileData = await provider.read(relativePath);
        this.database.upsertScannedDocument({
          workspaceId: workspace.id,
          name: basename(relativePath, ".excalidraw"),
          relativePath,
          fileSize: entry.size ?? fileData.byteLength,
          createdAt: entry.createdAt ?? entry.modifiedAt ?? Date.now(),
          modifiedAt: entry.modifiedAt ?? Date.now(),
          contentHash: hashData(fileData)
        });
        changed = true;
      } catch (error) {
        this.logger?.warn("workspace.watch.file-skipped", {
          reason: error instanceof Error ? error.message : "unknown read error"
        });
      }
    }

    if (changed) {
      this.indexChangedListeners.forEach((listener) => listener());
    }
  }

  private async stopActiveWatcher(): Promise<void> {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    await this.stopWatcher?.();
    this.stopWatcher = null;
  }

  async dispose(): Promise<void> {
    await this.stopActiveWatcher();
  }
}
