import { Check, MoreHorizontal, Trash2, X } from "lucide-react";
import type { AiSessionSummary } from "@shared/types";

interface AiSessionSidebarProps {
  sessions: AiSessionSummary[];
  activeSessionId?: string;
  renamingSessionId: string | null;
  renameDraft: string;
  onSelect: (sessionId: string) => void;
  onStartRename: (session: AiSessionSummary) => void;
  onRenameDraftChange: (value: string) => void;
  onRename: (session: AiSessionSummary) => void;
  onCancelRename: () => void;
  onDelete: (session: AiSessionSummary) => void;
}

type SessionGroup = { label: string; items: AiSessionSummary[] };

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupSessions(sessions: AiSessionSummary[]): SessionGroup[] {
  const today = startOfDay(Date.now());
  const yesterday = today - 86400000;
  const buckets: SessionGroup[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "更早", items: [] }
  ];
  for (const session of sessions) {
    const day = startOfDay(session.updatedAt);
    if (day >= today) buckets[0].items.push(session);
    else if (day >= yesterday) buckets[1].items.push(session);
    else buckets[2].items.push(session);
  }
  return buckets.filter((group) => group.items.length > 0);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function AiSessionSidebar({
  sessions,
  activeSessionId,
  renamingSessionId,
  renameDraft,
  onSelect,
  onStartRename,
  onRenameDraftChange,
  onRename,
  onCancelRename,
  onDelete
}: AiSessionSidebarProps) {
  const groups = groupSessions(sessions);

  return (
    <nav className="ai-conversation-sidebar" aria-label="AI 对话列表">
      {groups.map((group) => (
        <div className="ai-session-group" key={group.label}>
          <div className="ai-session-group__label">{group.label}</div>
          <div className="ai-session-list">
            {group.items.map((session) => (
              <div
                className={`ai-session-item ${session.id === activeSessionId ? "is-active" : ""}`}
                key={session.id}
              >
                {renamingSessionId === session.id ? (
                  <form
                    className="ai-session-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onRename(session);
                    }}
                  >
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(event) => onRenameDraftChange(event.target.value)}
                    />
                    <button className="button button--compact" type="submit" aria-label="保存名称">
                      <Check size={13} />
                    </button>
                    <button
                      className="button button--compact"
                      type="button"
                      aria-label="取消重命名"
                      onClick={onCancelRename}
                    >
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <button type="button" onClick={() => onSelect(session.id)}>
                    <strong>{session.title}</strong>
                    <small>{session.latestPrompt ?? "尚未发送消息"}</small>
                    <small>{formatTime(session.updatedAt)}</small>
                  </button>
                )}
                <div className="ai-session-item__actions">
                  <button type="button" aria-label="重命名" onClick={() => onStartRename(session)}>
                    <MoreHorizontal size={14} />
                  </button>
                  <button type="button" aria-label="删除" onClick={() => onDelete(session)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!sessions.length && <p className="ai-session-empty">暂无历史对话</p>}
    </nav>
  );
}
