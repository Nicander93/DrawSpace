import type Database from "better-sqlite3";

/** AI 会话只依赖现有 workspace/document 表，不改变现有迁移编号体系。 */
export function applyAiConversationMigration(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source_document_id TEXT,
      title TEXT NOT NULL,
      draft_prompt TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY(source_document_id) REFERENCES documents(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS ai_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      base_turn_id TEXT,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      context_json TEXT,
      status TEXT NOT NULL,
      mermaid TEXT,
      error_message TEXT,
      model_name TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      inserted_document_id TEXT,
      inserted_at INTEGER,
      FOREIGN KEY(session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(base_turn_id) REFERENCES ai_turns(id) ON DELETE SET NULL,
      FOREIGN KEY(inserted_document_id) REFERENCES documents(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS ai_attachments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      turn_id TEXT,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(turn_id) REFERENCES ai_turns(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ai_sessions_workspace_updated
      ON ai_sessions(workspace_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_turns_session_created
      ON ai_turns(session_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_ai_attachments_turn
      ON ai_attachments(turn_id);
  `);
}
