import { Check, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import type { AiSessionSummary } from "@shared/types";

interface AiSessionSidebarProps {
  sessions: AiSessionSummary[];
  activeSessionId?: string;
  renamingSessionId: string | null;
  renameDraft: string;
  onNew: () => void;
  onSelect: (sessionId: string) => void;
  onStartRename: (session: AiSessionSummary) => void;
  onRenameDraftChange: (value: string) => void;
  onRename: (session: AiSessionSummary) => void;
  onCancelRename: () => void;
  onDelete: (session: AiSessionSummary) => void;
}

export function AiSessionSidebar({ sessions, activeSessionId, renamingSessionId, renameDraft, onNew, onSelect, onStartRename, onRenameDraftChange, onRename, onCancelRename, onDelete }: AiSessionSidebarProps) {
  return (
    <nav className="ai-conversation-sidebar" aria-label="AI 对话列表">
      <button className="button button--primary button--compact ai-new-session" type="button" onClick={onNew}><Plus size={15} />新建对话</button>
      <div className="ai-session-list">
        {sessions.map((session) => (
          <div className={`ai-session-item ${session.id === activeSessionId ? "is-active" : ""}`} key={session.id}>
            {renamingSessionId === session.id ? (
              <form className="ai-session-rename" onSubmit={(event) => { event.preventDefault(); onRename(session); }}>
                <input autoFocus value={renameDraft} onChange={(event) => onRenameDraftChange(event.target.value)} />
                <button className="button button--compact" type="submit" aria-label="保存名称"><Check size={13} /></button>
                <button className="button button--compact" type="button" aria-label="取消重命名" onClick={onCancelRename}><X size={13} /></button>
              </form>
            ) : (
              <button type="button" onClick={() => onSelect(session.id)}>
                <strong>{session.title}</strong>
                <small>{session.latestPrompt ?? "尚未发送消息"}</small>
                <small>{session.sourceDocumentName ? `来源：${session.sourceDocumentName}` : "工作区会话"}</small>
              </button>
            )}
            <div className="ai-session-item__actions">
              <button type="button" aria-label="重命名" onClick={() => onStartRename(session)}><MoreHorizontal size={14} /></button>
              <button type="button" aria-label="删除" onClick={() => onDelete(session)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
