import { Check, PanelLeftClose, Pencil, Plus, Trash2, X } from "lucide-react";
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
  onCreate: () => void;
  onClose: () => void;
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
  const buckets: [SessionGroup, SessionGroup, SessionGroup] = [
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
  onDelete,
  onCreate,
  onClose
}: AiSessionSidebarProps) {
  const groups = groupSessions(sessions);

  return (
    <nav id="ai-conversation-history" className="ai-conversation-sidebar" aria-label="历史对话">
      <div className="ai-conversation-sidebar__header">
        <strong>历史对话</strong>
        <div className="ai-conversation-sidebar__header-actions">
          <button className="ai-conversation-sidebar__new" type="button" onClick={onCreate}>
            <Plus size={14} />
            <span>新建</span>
          </button>
          <button
            autoFocus
            className="ai-conversation-sidebar__close"
            type="button"
            aria-label="收起历史对话"
            title="收起历史对话"
            onClick={onClose}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>
      <div className="ai-conversation-sidebar__scroll">
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
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            onCancelRename();
                          }
                        }}
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
                    <button
                      type="button"
                      aria-current={session.id === activeSessionId ? "true" : undefined}
                      onClick={() => onSelect(session.id)}
                    >
                      <strong>{session.title}</strong>
                      <span className="ai-session-item__meta">
                        <small>{session.latestPrompt ?? "尚未发送消息"}</small>
                        <time dateTime={new Date(session.updatedAt).toISOString()}>{formatTime(session.updatedAt)}</time>
                      </span>
                    </button>
                  )}
                  <div className="ai-session-item__actions">
                    <button
                      type="button"
                      aria-label="重命名"
                      title="重命名"
                      onClick={() => onStartRename(session)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="删除"
                      title="删除"
                      onClick={() => onDelete(session)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!sessions.length && <p className="ai-session-empty">暂无历史对话</p>}
      </div>
    </nav>
  );
}
