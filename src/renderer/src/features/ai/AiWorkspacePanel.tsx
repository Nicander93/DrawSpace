import { AlertCircle, History, Plus, Settings2, Sparkles, Star, X } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { AiImageUpload, AiSessionDetail, AiSessionSummary, CanvasDocument } from "@shared/types";
import type { AiCanvasBridge } from "./AiCanvasBridge";
import { useAiWorkspaceStore } from "../../stores/aiWorkspaceStore";
import { Modal } from "../../components/Modal";
import { AiComposer, type AiComposerHandle } from "./components/AiComposer";
import { AiSessionSidebar } from "./components/AiSessionSidebar";
import { AiSettingsPanel } from "./components/AiSettingsPanel";
import { AiTurnMessage } from "./components/AiTurnMessage";
import { aiComposerReducer, initialAiComposerState } from "./model/composerReducer";
import type { PendingImage } from "./model/composerReducer";
import "./ai-workspace.css";

interface AiWorkspacePanelProps {
  open: boolean;
  workspaceId?: string;
  activeDocument?: CanvasDocument | null;
  activeBridge?: AiCanvasBridge;
  onClose: () => void;
}

const SUGGESTIONS = [
  "生成一张用户登录流程图",
  "解释当前图表的核心逻辑",
  "优化现有图表的结构和布局"
] as const;

const getError = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function AiWorkspacePanel({
  open,
  workspaceId,
  activeDocument,
  activeBridge,
  onClose
}: AiWorkspacePanelProps) {
  const [sessions, setSessions] = useState<AiSessionSummary[]>([]);
  const activeSessionId = useAiWorkspaceStore((state) =>
    workspaceId ? state.activeSessionIdByWorkspace[workspaceId] : undefined
  );
  const setActiveSession = useAiWorkspaceStore((state) => state.setActiveSession);
  const selectionSnapshot = useAiWorkspaceStore((state) =>
    activeDocument?.id ? state.canvasSnapshots[activeDocument.id] : undefined
  );
  const panelView = useAiWorkspaceStore((state) => state.panelView);
  const setPanelView = useAiWorkspaceStore((state) => state.setPanelView);
  const consumePendingIntent = useAiWorkspaceStore((state) => state.consumePendingIntent);
  const pendingIntent = useAiWorkspaceStore((state) => state.pendingIntent);
  const [detail, setDetail] = useState<AiSessionDetail | null>(null);
  const [composer, dispatchComposer] = useReducer(aiComposerReducer, initialAiComposerState);
  const { draft, submitting: busy, context } = composer;
  const {
    baseTurnId: selectedBaseTurnId,
    useSelection: pendingSelection,
    includeSelectionAppearance: pendingSelectionImage,
    images: pendingImages
  } = context;
  const [panelError, setPanelError] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingSession, setDeletingSession] = useState<AiSessionSummary | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const draftTimerRef = useRef<number | undefined>(undefined);
  const composerRef = useRef<AiComposerHandle>(null);

  const refreshSessions = async (): Promise<void> => {
    if (!workspaceId) return;
    const next = await window.desktopApi.ai.listSessions(workspaceId);
    setSessions(next);
    const persisted = useAiWorkspaceStore.getState().activeSessionIdByWorkspace[workspaceId];
    const selected = next.find((session) => session.id === persisted)?.id ?? next[0]?.id;
    if (selected && selected !== activeSessionId) {
      setActiveSession(workspaceId, selected);
    }
    if (!selected) {
      const created = await window.desktopApi.ai.createSession({
        workspaceId,
        sourceDocumentId: activeDocument?.id
      });
      setSessions([created]);
      setActiveSession(workspaceId, created.id);
    }
  };

  const refreshDetail = async (sessionId = activeSessionId): Promise<void> => {
    if (!sessionId) return;
    const next = await window.desktopApi.ai.getSession(sessionId);
    setDetail(next);
    dispatchComposer({ type: "reset-after-send" });
    dispatchComposer({ type: "set-draft", value: next.draftPrompt });
  };

  useEffect(() => {
    if (!open || !workspaceId) return;
    void refreshSessions().catch((reason) =>
      setPanelError(getError(reason, "无法读取 AI 对话"))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  useEffect(() => {
    if (!activeSessionId || !workspaceId) return;
    void refreshDetail().catch((reason) =>
      setPanelError(getError(reason, "无法读取当前对话"))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, workspaceId]);

  useEffect(
    () =>
      window.desktopApi.ai.onTurnUpdated((turn) => {
        if (turn.sessionId !== activeSessionId) return;
        setDetail((current) => {
          if (!current) return current;
          const exists = current.turns.some((item) => item.id === turn.id);
          return {
            ...current,
            turns: exists
              ? current.turns.map((item) => (item.id === turn.id ? turn : item))
              : [...current.turns, turn]
          };
        });
        if (workspaceId) {
          void window.desktopApi.ai.listSessions(workspaceId).then(setSessions).catch(() => undefined);
        }
      }),
    [activeSessionId, workspaceId]
  );

  useEffect(
    () => () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
      context.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [context.images]
  );

  useEffect(() => {
    if (!open || !pendingIntent) return;
    const intent = consumePendingIntent();
    if (intent === "upload") {
      window.setTimeout(() => composerRef.current?.openFilePicker(), 0);
    } else if (intent === "explain-selection") {
      dispatchComposer({ type: "use-selection", enabled: true });
      dispatchComposer({ type: "set-draft", value: "请解释当前选中图表的内容与逻辑" });
      if (activeSessionId) {
        void window.desktopApi.ai
          .updateSession({
            sessionId: activeSessionId,
            draftPrompt: "请解释当前选中图表的内容与逻辑"
          })
          .catch(() => undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingIntent]);

  const updateDraft = (value: string): void => {
    dispatchComposer({ type: "set-draft", value });
    if (!activeSessionId) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      void window.desktopApi.ai
        .updateSession({ sessionId: activeSessionId, draftPrompt: value })
        .catch(() => undefined);
    }, 350);
  };

  const createSession = async (): Promise<void> => {
    if (!workspaceId) return;
    try {
      const created = await window.desktopApi.ai.createSession({
        workspaceId,
        sourceDocumentId: activeDocument?.id
      });
      setSessions((items) => [created, ...items]);
      setActiveSession(workspaceId, created.id);
      setPanelError(null);
    } catch (reason) {
      setPanelError(getError(reason, "新建对话失败"));
    }
  };

  const renameSession = async (session: AiSessionSummary): Promise<void> => {
    const title = renameDraft.trim();
    if (!title || title === session.title) {
      setRenamingSessionId(null);
      return;
    }
    try {
      const updated = await window.desktopApi.ai.updateSession({
        sessionId: session.id,
        title
      });
      setSessions((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );
      if (detail?.id === updated.id) {
        setDetail((current) => (current ? { ...current, ...updated } : current));
      }
    } catch (reason) {
      setPanelError(getError(reason, "重命名失败"));
    } finally {
      setRenamingSessionId(null);
    }
  };

  const deleteSession = async (session: AiSessionSummary): Promise<void> => {
    try {
      await window.desktopApi.ai.deleteSession(session.id);
      const remaining = sessions.filter((item) => item.id !== session.id);
      setSessions(remaining);
      if (workspaceId && activeSessionId === session.id) {
        setActiveSession(workspaceId, remaining[0]?.id);
        setDetail(null);
      }
    } catch (reason) {
      setPanelError(getError(reason, "删除对话失败"));
    } finally {
      setDeletingSession(null);
    }
  };

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const file = Array.from(files)[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setPanelError("只支持 PNG、JPEG 或 WEBP 图片");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPanelError("单张图片不能超过 8 MB");
      return;
    }
    const data = await file.arrayBuffer();
    const previewUrl = URL.createObjectURL(file);
    context.images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    dispatchComposer({
      type: "add-image",
      image: {
        fileName: file.name || "image",
        mimeType: file.type as PendingImage["mimeType"],
        data,
        previewUrl
      }
    });
    setPanelError(null);
  };

  const removeImage = (image: PendingImage): void => {
    URL.revokeObjectURL(image.previewUrl);
    dispatchComposer({ type: "remove-image", image });
  };

  const send = async (): Promise<void> => {
    const prompt = draft.trim();
    if (!activeSessionId || !prompt || busy) return;
    const selection = pendingSelection ? activeBridge?.getSelectionContext() : undefined;
    if (pendingSelection && !selection) {
      setPanelError("当前没有可参考的选区");
      return;
    }
    dispatchComposer({ type: "set-submitting", value: true });
    setPanelError(null);
    try {
      let selectionImage: AiImageUpload | undefined;
      if (pendingSelectionImage && activeBridge?.exportSelectionPreview) {
        try {
          selectionImage = await activeBridge.exportSelectionPreview();
        } catch {
          setPanelError("选区图片导出失败，将仅发送结构摘要");
        }
      }
      const images = pendingImages.length
        ? pendingImages.map((image) => ({
            fileName: image.fileName,
            mimeType: image.mimeType,
            data: image.data
          }))
        : selectionImage
          ? [selectionImage]
          : undefined;
      const mode = selectedBaseTurnId
        ? "revise"
        : images
          ? "reference_image"
          : pendingSelection
            ? "extend_selection"
            : "create";
      await window.desktopApi.ai.generateTurn({
        sessionId: activeSessionId,
        prompt,
        mode,
        baseTurnId: selectedBaseTurnId,
        selection,
        images
      });
      dispatchComposer({ type: "reset-after-send" });
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      await refreshSessions();
      await refreshDetail(activeSessionId);
    } catch (reason) {
      setPanelError(getError(reason, "AI 图表生成失败"));
      await refreshDetail(activeSessionId).catch(() => undefined);
    } finally {
      dispatchComposer({ type: "set-submitting", value: false });
    }
  };

  const repair = async (turnId: string, prompt: string, parseError?: string): Promise<void> => {
    if (!activeSessionId || !parseError || busy) return;
    dispatchComposer({ type: "set-submitting", value: true });
    setPanelError(null);
    try {
      await window.desktopApi.ai.repairTurn({
        sessionId: activeSessionId,
        turnId,
        prompt,
        parseError
      });
      await refreshSessions();
      await refreshDetail(activeSessionId);
    } catch (reason) {
      setPanelError(getError(reason, "AI 修复失败"));
    } finally {
      dispatchComposer({ type: "set-submitting", value: false });
    }
  };

  const isGenerating = Boolean(detail?.turns.some((turn) => turn.status === "generating"));
  const selectionAvailable = Boolean(selectionSnapshot?.hasSelection);
  const showChat = panelView === "chat";

  return (
    <aside className={`ai-workspace-panel ${open ? "is-open" : "is-closed"}`} aria-hidden={!open}>
      <header className="ai-workspace-panel__header">
        <div className="ai-workspace-panel__identity">
          <span className="ai-workspace-panel__mark">
            <Sparkles size={17} />
          </span>
          <div>
            <strong>AI 图表助手</strong>
            <span>帮你把想法变成图表</span>
          </div>
        </div>
        <div className="ai-workspace-panel__actions">
          {showChat && (
            <button
              className="button button--compact ai-header-new"
              type="button"
              onClick={() => void createSession()}
            >
              <Plus size={15} />
              新建对话
            </button>
          )}
          {showChat && (
            <button
              className={`editor-icon-button ${historyOpen ? "is-active" : ""}`}
              type="button"
              aria-label={historyOpen ? "收起历史" : "展开历史"}
              aria-pressed={historyOpen}
              title={historyOpen ? "收起历史" : "展开历史"}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <History size={17} />
            </button>
          )}
          <button
            className={`editor-icon-button ${panelView === "settings" ? "is-active" : ""}`}
            type="button"
            aria-label="AI 设置"
            aria-pressed={panelView === "settings"}
            title="AI 设置"
            onClick={() => setPanelView(panelView === "settings" ? "chat" : "settings")}
          >
            <Settings2 size={17} />
          </button>
          <button className="editor-icon-button" type="button" aria-label="关闭 AI 面板" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      {showChat ? (
        <div className={`ai-workspace-panel__body ${historyOpen ? "has-history" : "no-history"}`}>
          {historyOpen && (
            <AiSessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              renamingSessionId={renamingSessionId}
              renameDraft={renameDraft}
              onSelect={(sessionId) => {
                if (workspaceId) setActiveSession(workspaceId, sessionId);
              }}
              onStartRename={(session) => {
                setRenamingSessionId(session.id);
                setRenameDraft(session.title);
              }}
              onRenameDraftChange={setRenameDraft}
              onRename={(session) => void renameSession(session)}
              onCancelRename={() => setRenamingSessionId(null)}
              onDelete={setDeletingSession}
            />
          )}
          <section className="ai-conversation-view">
            <div className="ai-turn-list">
              {detail?.turns.length ? (
                detail.turns.map((turn) => (
                  <AiTurnMessage
                    key={turn.id}
                    turn={turn}
                    activeBridge={activeBridge}
                    activeDocumentId={activeDocument?.id}
                    selectionAvailable={selectionAvailable}
                    onBase={() => dispatchComposer({ type: "use-base-turn", turnId: turn.id })}
                    onRepair={(parseError) => void repair(turn.id, turn.prompt, parseError)}
                    onRefresh={() => refreshDetail()}
                  />
                ))
              ) : (
                <div className="ai-empty-state">
                  <div className="ai-empty-state__avatar" aria-hidden="true">
                    <Sparkles size={22} />
                  </div>
                  <p className="ai-empty-state__greeting">你好！我可以帮你：</p>
                  <div className="ai-empty-state__suggestions">
                    {SUGGESTIONS.map((text) => (
                      <button
                        key={text}
                        type="button"
                        className="ai-suggestion-chip"
                        onClick={() => updateDraft(text)}
                      >
                        <Star size={13} />
                        <span>{text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <AiComposer
              ref={composerRef}
              draft={draft}
              busy={busy || isGenerating}
              hasDetail={Boolean(detail)}
              selectionAvailable={selectionAvailable}
              pendingSelection={pendingSelection}
              pendingSelectionImage={pendingSelectionImage}
              selectedBaseTurnId={selectedBaseTurnId}
              pendingImages={pendingImages}
              onDraftChange={updateDraft}
              onSend={() => void send()}
              onAddFiles={(files) => void addFiles(files)}
              onToggleSelection={() =>
                dispatchComposer({ type: "use-selection", enabled: !pendingSelection })
              }
              onToggleSelectionImage={() =>
                dispatchComposer({
                  type: "include-selection-appearance",
                  enabled: !pendingSelectionImage
                })
              }
              onClearBase={() => dispatchComposer({ type: "use-base-turn" })}
              onClearSelection={() => dispatchComposer({ type: "use-selection", enabled: false })}
              onRemoveImage={removeImage}
            />
            {panelError && (
              <div className="ai-panel-error ai-panel-error--global">
                <AlertCircle size={15} />
                <span>{panelError}</span>
                <button type="button" onClick={() => setPanelError(null)}>
                  <X size={14} />
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="ai-workspace-panel__body no-history">
          <AiSettingsPanel />
        </div>
      )}
      {deletingSession && (
        <Modal
          title="删除对话"
          onClose={() => setDeletingSession(null)}
          footer={
            <>
              <button className="button" type="button" onClick={() => setDeletingSession(null)}>
                取消
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => void deleteSession(deletingSession)}
              >
                删除
              </button>
            </>
          }
        >
          <p className="ai-confirm-copy">
            确定删除“{deletingSession.title}”及其中的生成记录吗？
          </p>
        </Modal>
      )}
    </aside>
  );
}
