import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  CanvasDocument,
  DocumentListQuery,
  DocumentListResult,
  Workspace,
  WorkspaceProviderType
} from "@shared/types";

interface WorkspaceRow {
  id: string;
  name: string;
  provider_type: string;
  root_path: string;
  created_at: number;
  last_opened_at: number;
  is_active: number;
}

interface DocumentRow {
  id: string;
  workspace_id: string;
  name: string;
  relative_path: string;
  extension: ".excalidraw";
  file_size: number;
  created_at: number;
  modified_at: number;
  last_opened_at: number | null;
  is_favorite: number;
  is_deleted: number;
  content_hash: string | null;
  thumbnail_path: string | null;
  sync_status: "local" | "conflict" | "error";
  deleted_at?: number | null;
  original_relative_path?: string | null;
}

export interface IndexedDocumentInput {
  id?: string;
  workspaceId: string;
  name: string;
  relativePath: string;
  fileSize: number;
  createdAt: number;
  modifiedAt: number;
  contentHash: string;
}

const mapWorkspace = (row: WorkspaceRow, isAvailable = true): Workspace => ({
  id: row.id,
  name: row.name,
  // 历史 nutstore 等记录统一视为 local
  providerType: "local",
  rootPath: row.root_path,
  createdAt: row.created_at,
  lastOpenedAt: row.last_opened_at,
  isActive: Boolean(row.is_active),
  isAvailable
});

const mapDocument = (row: DocumentRow): CanvasDocument => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  relativePath: row.relative_path,
  extension: row.extension,
  fileSize: row.file_size,
  createdAt: row.created_at,
  modifiedAt: row.modified_at,
  lastOpenedAt: row.last_opened_at,
  isFavorite: Boolean(row.is_favorite),
  isDeleted: Boolean(row.is_deleted),
  contentHash: row.content_hash,
  thumbnailPath: row.thumbnail_path,
  syncStatus: row.sync_status,
  deletedAt: row.deleted_at,
  originalRelativePath: row.original_relative_path
});

export class DatabaseService {
  private readonly database: Database.Database;

  constructor(databasePath: string) {
    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        root_path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        extension TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER,
        modified_at INTEGER,
        indexed_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        thumbnail_path TEXT,
        sync_status TEXT NOT NULL DEFAULT 'local',
        UNIQUE(workspace_id, relative_path),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS trash_records (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL UNIQUE,
        original_relative_path TEXT NOT NULL,
        trash_relative_path TEXT NOT NULL,
        deleted_at INTEGER NOT NULL,
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_sessions (
        id TEXT PRIMARY KEY,
        document_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        exit_status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_workspace_deleted
        ON documents(workspace_id, is_deleted);
      CREATE INDEX IF NOT EXISTS idx_documents_last_opened
        ON documents(workspace_id, last_opened_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_name
        ON documents(workspace_id, name);
    `);
  }

  close(): void {
    this.database.close();
  }

  getActiveWorkspace(): Workspace | null {
    const row = this.database
      .prepare("SELECT * FROM workspaces WHERE is_active = 1 LIMIT 1")
      .get() as WorkspaceRow | undefined;
    return row ? mapWorkspace(row) : null;
  }

  activateWorkspace(input: {
    name: string;
    rootPath: string;
    providerType: WorkspaceProviderType;
    id?: string;
    createdAt?: number;
  }): Workspace {
    const now = Date.now();
    const transaction = this.database.transaction(() => {
      this.database.prepare("UPDATE workspaces SET is_active = 0").run();
      this.database
        .prepare(
          `INSERT INTO workspaces (
            id, name, provider_type, root_path, created_at, last_opened_at, is_active
          ) VALUES (
            @id, @name, @providerType, @rootPath, @createdAt, @lastOpenedAt, 1
          )
          ON CONFLICT(root_path) DO UPDATE SET
            name = excluded.name,
            provider_type = excluded.provider_type,
            last_opened_at = excluded.last_opened_at,
            is_active = 1`
        )
        .run({
          id: input.id ?? randomUUID(),
          name: input.name,
          providerType: input.providerType,
          rootPath: input.rootPath,
          createdAt: input.createdAt ?? now,
          lastOpenedAt: now
        });
    });
    transaction();

    const row = this.database
      .prepare("SELECT * FROM workspaces WHERE root_path = ?")
      .get(input.rootPath) as WorkspaceRow;
    return mapWorkspace(row);
  }

  upsertScannedDocument(input: IndexedDocumentInput): CanvasDocument {
    const id = input.id ?? randomUUID();
    this.database
      .prepare(
        `INSERT INTO documents (
          id, workspace_id, name, relative_path, extension, file_size,
          created_at, modified_at, indexed_at, content_hash
        ) VALUES (
          @id, @workspaceId, @name, @relativePath, '.excalidraw', @fileSize,
          @createdAt, @modifiedAt, @indexedAt, @contentHash
        )
        ON CONFLICT(workspace_id, relative_path) DO UPDATE SET
          name = excluded.name,
          file_size = excluded.file_size,
          modified_at = excluded.modified_at,
          indexed_at = excluded.indexed_at,
          content_hash = excluded.content_hash,
          is_deleted = 0,
          sync_status = 'local'`
      )
      .run({
        ...input,
        id,
        indexedAt: Date.now()
      });

    const document = this.getDocumentByPath(input.workspaceId, input.relativePath);
    if (!document) {
      throw new Error("写入文档索引失败");
    }
    return document;
  }

  /**
   * 删除磁盘上已不存在的文档索引。
   * @param workspaceId 工作区 ID
   * @param relativePaths 当前仍存在文件的相对路径集合；不在此集合中文档将被移出索引
   */
  deleteMissingDocuments(workspaceId: string, relativePaths: string[]): void {
    const activePaths = new Set(relativePaths);
    const rows = this.database
      .prepare(
        "SELECT id, relative_path FROM documents WHERE workspace_id = ? AND is_deleted = 0"
      )
      .all(workspaceId) as Array<{ id: string; relative_path: string }>;
    const deleteStatement = this.database.prepare("DELETE FROM documents WHERE id = ?");
    const transaction = this.database.transaction(() => {
      for (const row of rows) {
        if (!activePaths.has(row.relative_path)) {
          deleteStatement.run(row.id);
        }
      }
    });
    transaction();
  }

  getDocument(documentId: string): CanvasDocument | null {
    const row = this.database
      .prepare(
        `SELECT d.*, t.deleted_at, t.original_relative_path
         FROM documents d
         LEFT JOIN trash_records t ON t.document_id = d.id
         WHERE d.id = ?`
      )
      .get(documentId) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  getDocumentByPath(workspaceId: string, relativePath: string): CanvasDocument | null {
    const row = this.database
      .prepare(
        "SELECT * FROM documents WHERE workspace_id = ? AND relative_path = ?"
      )
      .get(workspaceId, relativePath) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  listDocuments(
    workspaceId: string,
    query: DocumentListQuery
  ): DocumentListResult {
    const conditions = ["d.workspace_id = @workspaceId"];
    if (query.filter === "trash") {
      conditions.push("d.is_deleted = 1");
    } else {
      conditions.push("d.is_deleted = 0");
    }
    if (query.filter === "recent") {
      conditions.push("d.last_opened_at IS NOT NULL");
    }
    if (query.filter === "favorites") {
      conditions.push("d.is_favorite = 1");
    }
    if (query.search?.trim()) {
      conditions.push(
        "(LOWER(d.name) LIKE LOWER(@search) OR LOWER(d.relative_path) LIKE LOWER(@search))"
      );
    }

    const orderBy = {
      lastOpened: "d.last_opened_at DESC, d.modified_at DESC",
      modified: "d.modified_at DESC",
      nameAsc: "d.name COLLATE NOCASE ASC",
      nameDesc: "d.name COLLATE NOCASE DESC",
      created: "d.created_at DESC"
    }[query.sort ?? (query.filter === "recent" ? "lastOpened" : "modified")];

    const parameters = {
      workspaceId,
      search: `%${query.search?.trim() ?? ""}%`,
      limit: query.filter === "recent" ? Math.min(query.limit ?? 20, 20) : query.limit ?? 100,
      offset: query.offset ?? 0
    };
    const whereClause = conditions.join(" AND ");
    const rows = this.database
      .prepare(
        `SELECT d.*, t.deleted_at, t.original_relative_path
         FROM documents d
         LEFT JOIN trash_records t ON t.document_id = d.id
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT @limit OFFSET @offset`
      )
      .all(parameters) as DocumentRow[];
    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS total FROM documents d WHERE ${whereClause}`)
      .get(parameters) as { total: number };

    return {
      documents: rows.map(mapDocument),
      total: countRow.total
    };
  }

  updateDocumentPath(
    documentId: string,
    name: string,
    relativePath: string,
    modifiedAt: number
  ): CanvasDocument {
    this.database
      .prepare(
        `UPDATE documents
         SET name = ?, relative_path = ?, modified_at = ?, indexed_at = ?
         WHERE id = ?`
      )
      .run(name, relativePath, modifiedAt, Date.now(), documentId);
    return this.requireDocument(documentId);
  }

  updateDocumentFile(input: {
    documentId: string;
    fileSize: number;
    modifiedAt: number;
    contentHash: string;
    syncStatus?: "local" | "conflict" | "error";
  }): CanvasDocument {
    this.database
      .prepare(
        `UPDATE documents
         SET file_size = @fileSize, modified_at = @modifiedAt,
             indexed_at = @indexedAt, content_hash = @contentHash,
             sync_status = @syncStatus
         WHERE id = @documentId`
      )
      .run({
        ...input,
        indexedAt: Date.now(),
        syncStatus: input.syncStatus ?? "local"
      });
    return this.requireDocument(input.documentId);
  }

  markOpened(documentId: string): CanvasDocument {
    this.database
      .prepare("UPDATE documents SET last_opened_at = ? WHERE id = ?")
      .run(Date.now(), documentId);
    return this.requireDocument(documentId);
  }

  toggleFavorite(documentId: string): CanvasDocument {
    this.database
      .prepare(
        "UPDATE documents SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ?"
      )
      .run(documentId);
    return this.requireDocument(documentId);
  }

  moveToTrash(
    documentId: string,
    originalRelativePath: string,
    trashRelativePath: string
  ): void {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          "UPDATE documents SET relative_path = ?, is_deleted = 1 WHERE id = ?"
        )
        .run(trashRelativePath, documentId);
      this.database
        .prepare(
          `INSERT INTO trash_records (
            id, document_id, original_relative_path, trash_relative_path, deleted_at
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), documentId, originalRelativePath, trashRelativePath, Date.now());
    });
    transaction();
  }

  restoreFromTrash(documentId: string, relativePath: string): CanvasDocument {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          "UPDATE documents SET relative_path = ?, is_deleted = 0, modified_at = ? WHERE id = ?"
        )
        .run(relativePath, Date.now(), documentId);
      this.database.prepare("DELETE FROM trash_records WHERE document_id = ?").run(documentId);
    });
    transaction();
    return this.requireDocument(documentId);
  }

  deleteDocument(documentId: string): void {
    this.database.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
  }

  setThumbnail(documentId: string, thumbnailPath: string): void {
    this.database
      .prepare("UPDATE documents SET thumbnail_path = ? WHERE id = ?")
      .run(thumbnailPath, documentId);
  }

  startSession(documentId: string): string {
    const sessionId = randomUUID();
    this.database
      .prepare(
        `INSERT INTO app_sessions (
          id, document_id, started_at, exit_status
        ) VALUES (?, ?, ?, 'editing')`
      )
      .run(sessionId, documentId, Date.now());
    return sessionId;
  }

  closeSession(sessionId: string): void {
    this.database
      .prepare(
        "UPDATE app_sessions SET ended_at = ?, exit_status = 'normal' WHERE id = ?"
      )
      .run(Date.now(), sessionId);
  }

  wasSessionInterrupted(sessionId: string): boolean {
    const row = this.database
      .prepare("SELECT ended_at, exit_status FROM app_sessions WHERE id = ?")
      .get(sessionId) as { ended_at: number | null; exit_status: string } | undefined;
    return Boolean(row && row.ended_at === null && row.exit_status === "editing");
  }

  private requireDocument(documentId: string): CanvasDocument {
    const document = this.getDocument(documentId);
    if (!document) {
      throw new Error("找不到画布");
    }
    return document;
  }
}
