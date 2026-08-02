import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  AiAttachment,
  AiContextSnapshot,
  AiSessionDetail,
  AiSessionSummary,
  AiTurn,
  AiTurnMode
} from "@shared/types";

type SessionRow = {
  id: string; workspace_id: string; source_document_id: string | null;
  source_document_name: string | null; title: string; draft_prompt: string;
  created_at: number; updated_at: number; turn_count: number;
  latest_turn_status: AiTurn["status"] | null; latest_prompt: string | null;
};
type TurnRow = {
  id: string; session_id: string; base_turn_id: string | null; mode: AiTurnMode;
  prompt: string; context_json: string | null; status: AiTurn["status"];
  mermaid: string | null; error_message: string | null; model_name: string | null;
  created_at: number; completed_at: number | null; inserted_document_id: string | null;
  inserted_at: number | null;
};
type AttachmentRow = {
  id: string; session_id: string; turn_id: string | null; kind: AiAttachment["kind"];
  mime_type: AiAttachment["mimeType"]; file_path: string; byte_size: number;
  width: number | null; height: number | null; created_at: number;
};

const mapAttachment = (row: AttachmentRow): AiAttachment => ({
  id: row.id, sessionId: row.session_id, ...(row.turn_id ? { turnId: row.turn_id } : {}),
  kind: row.kind, mimeType: row.mime_type, byteSize: row.byte_size,
  ...(row.width === null ? {} : { width: row.width }),
  ...(row.height === null ? {} : { height: row.height }), createdAt: row.created_at
});

const parseContext = (value: string | null): AiContextSnapshot | undefined => {
  if (!value) return undefined;
  try { return JSON.parse(value) as AiContextSnapshot; } catch { return undefined; }
};

const mapTurn = (row: TurnRow, attachments: AiAttachment[]): AiTurn => ({
  id: row.id, sessionId: row.session_id,
  ...(row.base_turn_id ? { baseTurnId: row.base_turn_id } : {}), mode: row.mode,
  prompt: row.prompt, context: parseContext(row.context_json), status: row.status,
  ...(row.mermaid ? { mermaid: row.mermaid } : {}),
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  ...(row.model_name ? { modelName: row.model_name } : {}), createdAt: row.created_at,
  ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  ...(row.inserted_document_id ? { insertedDocumentId: row.inserted_document_id } : {}),
  ...(row.inserted_at === null ? {} : { insertedAt: row.inserted_at }), attachments
});

const mapSummary = (row: SessionRow): AiSessionSummary => ({
  id: row.id, workspaceId: row.workspace_id,
  ...(row.source_document_id ? { sourceDocumentId: row.source_document_id } : {}),
  ...(row.source_document_name ? { sourceDocumentName: row.source_document_name } : {}),
  title: row.title, draftPrompt: row.draft_prompt, createdAt: row.created_at,
  updatedAt: row.updated_at, turnCount: row.turn_count,
  ...(row.latest_turn_status ? { latestTurnStatus: row.latest_turn_status } : {}),
  ...(row.latest_prompt ? { latestPrompt: row.latest_prompt } : {})
});

const summaryQuery = `
  SELECT s.*, d.name AS source_document_name,
    (SELECT COUNT(*) FROM ai_turns t WHERE t.session_id = s.id) AS turn_count,
    (SELECT t.status FROM ai_turns t WHERE t.session_id = s.id ORDER BY t.created_at DESC LIMIT 1) AS latest_turn_status,
    (SELECT t.prompt FROM ai_turns t WHERE t.session_id = s.id ORDER BY t.created_at DESC LIMIT 1) AS latest_prompt
  FROM ai_sessions s LEFT JOIN documents d ON d.id = s.source_document_id
  WHERE s.deleted_at IS NULL`;

export class AiConversationRepository {
  constructor(private readonly database: Database.Database) {}

  createSession(input: { workspaceId: string; sourceDocumentId?: string; title: string }): AiSessionSummary {
    const now = Date.now();
    const id = randomUUID();
    this.database.prepare(`INSERT INTO ai_sessions (id, workspace_id, source_document_id, title, created_at, updated_at)
      VALUES (@id, @workspaceId, @sourceDocumentId, @title, @createdAt, @updatedAt)`).run({
      id, workspaceId: input.workspaceId, sourceDocumentId: input.sourceDocumentId ?? null,
      title: input.title.trim() || "新对话", createdAt: now, updatedAt: now
    });
    return this.requireSummary(this.database.prepare(`${summaryQuery} AND s.id = ?`).get(id) as SessionRow | undefined);
  }

  listSessions(workspaceId: string, options: { limit?: number; offset?: number; documentId?: string } = {}): AiSessionSummary[] {
    const conditions = ["s.workspace_id = @workspaceId"];
    if (options.documentId) conditions.push("s.source_document_id = @documentId");
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
    const rows = this.database.prepare(`${summaryQuery} AND ${conditions.join(" AND ")} ORDER BY s.updated_at DESC LIMIT @limit OFFSET @offset`).all({
      workspaceId, documentId: options.documentId, limit, offset: Math.max(options.offset ?? 0, 0)
    }) as SessionRow[];
    return rows.map(mapSummary);
  }

  getSession(sessionId: string): AiSessionDetail | null {
    const row = this.database.prepare(`${summaryQuery} AND s.id = ?`).get(sessionId) as SessionRow | undefined;
    if (!row) return null;
    const turnRows = this.database.prepare("SELECT * FROM ai_turns WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as TurnRow[];
    const attachmentRows = this.database.prepare("SELECT * FROM ai_attachments WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as AttachmentRow[];
    const attachmentsByTurn = new Map<string, AiAttachment[]>();
    for (const attachment of attachmentRows) {
      if (!attachment.turn_id) continue;
      const list = attachmentsByTurn.get(attachment.turn_id) ?? [];
      list.push(mapAttachment(attachment)); attachmentsByTurn.set(attachment.turn_id, list);
    }
    return { ...mapSummary(row), turns: turnRows.map((turn) => mapTurn(turn, attachmentsByTurn.get(turn.id) ?? [])) };
  }

  renameSession(sessionId: string, title: string): AiSessionSummary {
    this.database.prepare("UPDATE ai_sessions SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(title.trim(), Date.now(), sessionId);
    return this.requireSummary(this.database.prepare(`${summaryQuery} AND s.id = ?`).get(sessionId) as SessionRow | undefined);
  }

  updateDraft(sessionId: string, draftPrompt: string): void {
    this.database.prepare("UPDATE ai_sessions SET draft_prompt = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(draftPrompt, Date.now(), sessionId);
  }

  updateSession(input: { sessionId: string; title?: string; draftPrompt?: string }): AiSessionSummary {
    const fields: string[] = ["updated_at = @updatedAt"];
    const values: Record<string, unknown> = { sessionId: input.sessionId, updatedAt: Date.now() };
    if (input.title !== undefined) { fields.push("title = @title"); values.title = input.title.trim(); }
    if (input.draftPrompt !== undefined) { fields.push("draft_prompt = @draftPrompt"); values.draftPrompt = input.draftPrompt; }
    this.database.prepare(`UPDATE ai_sessions SET ${fields.join(", ")} WHERE id = @sessionId AND deleted_at IS NULL`).run(values);
    return this.requireSummary(this.database.prepare(`${summaryQuery} AND s.id = ?`).get(input.sessionId) as SessionRow | undefined);
  }

  deleteSession(sessionId: string): void {
    this.database.prepare("DELETE FROM ai_sessions WHERE id = ?").run(sessionId);
  }

  listAttachmentPaths(sessionId: string): string[] {
    return (this.database.prepare("SELECT file_path FROM ai_attachments WHERE session_id = ?").all(sessionId) as Array<{ file_path: string }>).map((row) => row.file_path);
  }

  getAttachmentPath(attachmentId: string): string {
    const row = this.database.prepare("SELECT file_path FROM ai_attachments WHERE id = ?").get(attachmentId) as { file_path: string } | undefined;
    if (!row) throw new Error("附件不存在");
    return row.file_path;
  }

  createTurn(input: { sessionId: string; baseTurnId?: string; mode: AiTurnMode; prompt: string; contextJson?: string; modelName?: string }): AiTurn {
    const id = randomUUID(); const now = Date.now();
    const transaction = this.database.transaction(() => {
      const session = this.database.prepare("SELECT title FROM ai_sessions WHERE id = ? AND deleted_at IS NULL").get(input.sessionId) as { title: string } | undefined;
      if (!session) throw new Error("对话不存在");
      const active = this.database.prepare("SELECT 1 FROM ai_turns WHERE session_id = ? AND status = 'generating' LIMIT 1").get(input.sessionId);
      if (active) throw new Error("当前对话正在生成，请等待完成或取消");
      this.database.prepare(`INSERT INTO ai_turns (id, session_id, base_turn_id, mode, prompt, context_json, status, model_name, created_at)
        VALUES (@id, @sessionId, @baseTurnId, @mode, @prompt, @contextJson, 'generating', @modelName, @createdAt)`).run({
        id, sessionId: input.sessionId, baseTurnId: input.baseTurnId ?? null, mode: input.mode,
        prompt: input.prompt, contextJson: input.contextJson ?? null, modelName: input.modelName ?? null, createdAt: now
      });
      const title = input.prompt.trim().slice(0, 32);
      this.database.prepare("UPDATE ai_sessions SET draft_prompt = '', updated_at = ?, title = CASE WHEN title = '新对话' AND ? <> '' THEN ? ELSE title END WHERE id = ?").run(now, title, title, input.sessionId);
    });
    transaction();
    return this.requireTurn(id);
  }

  completeTurn(turnId: string, mermaid: string, completedAt = Date.now()): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare("UPDATE ai_turns SET status = 'ready', mermaid = ?, error_message = NULL, completed_at = ? WHERE id = ?").run(mermaid, completedAt, turnId);
      this.touchSession(turnId);
    }); transaction();
  }

  failTurn(turnId: string, message: string, completedAt = Date.now()): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare("UPDATE ai_turns SET status = 'error', error_message = ?, completed_at = ? WHERE id = ?").run(message.slice(0, 5000), completedAt, turnId);
      this.touchSession(turnId);
    }); transaction();
  }

  cancelTurn(turnId: string): void { this.database.prepare("UPDATE ai_turns SET status = 'cancelled', completed_at = ? WHERE id = ? AND status = 'generating'").run(Date.now(), turnId); }

  markTurnInserted(turnId: string, documentId: string, insertedAt = Date.now()): void { this.database.prepare("UPDATE ai_turns SET inserted_document_id = ?, inserted_at = ? WHERE id = ?").run(documentId, insertedAt, turnId); }

  addAttachment(input: { sessionId: string; turnId?: string; kind: AiAttachment["kind"]; mimeType: AiAttachment["mimeType"]; filePath: string; byteSize: number; width?: number; height?: number }): AiAttachment {
    const id = randomUUID(); const createdAt = Date.now();
    this.database.prepare(`INSERT INTO ai_attachments (id, session_id, turn_id, kind, mime_type, file_path, byte_size, width, height, created_at)
      VALUES (@id, @sessionId, @turnId, @kind, @mimeType, @filePath, @byteSize, @width, @height, @createdAt)`).run({ ...input, id, turnId: input.turnId ?? null, width: input.width ?? null, height: input.height ?? null, createdAt });
    return mapAttachment(this.database.prepare("SELECT * FROM ai_attachments WHERE id = ?").get(id) as AttachmentRow);
  }

  updateTurnContext(turnId: string, contextJson: string): void {
    this.database.prepare("UPDATE ai_turns SET context_json = ? WHERE id = ?").run(contextJson, turnId);
  }

  markInterruptedTurns(): number {
    const result = this.database.prepare("UPDATE ai_turns SET status = 'error', error_message = '应用退出或生成过程被中断', completed_at = ? WHERE status = 'generating'").run(Date.now());
    return result.changes;
  }

  getTurn(turnId: string): AiTurn | null {
    const row = this.database.prepare("SELECT * FROM ai_turns WHERE id = ?").get(turnId) as TurnRow | undefined;
    if (!row) return null;
    const attachments = this.database.prepare("SELECT * FROM ai_attachments WHERE turn_id = ?").all(turnId) as AttachmentRow[];
    return mapTurn(row, attachments.map(mapAttachment));
  }

  private touchSession(turnId: string): void { this.database.prepare("UPDATE ai_sessions SET updated_at = (SELECT completed_at FROM ai_turns WHERE id = ?) WHERE id = (SELECT session_id FROM ai_turns WHERE id = ?)").run(turnId, turnId); }
  private requireTurn(id: string): AiTurn { const turn = this.getTurn(id); if (!turn) throw new Error("生成记录不存在"); return turn; }
  private requireSummary(row: SessionRow | undefined): AiSessionSummary { if (!row) throw new Error("对话不存在"); return mapSummary(row); }
}
