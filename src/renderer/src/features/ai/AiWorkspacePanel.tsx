import { AlertCircle, Check, Code2, FileImage, LoaderCircle, MoreHorizontal, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AiImageUpload, AiSessionDetail, AiSessionSummary, AiTurn, CanvasDocument } from "@shared/types";
import type { AiCanvasBridge } from "./AiCanvasBridge";
import { MermaidDiagramAdapter, type ConvertedMermaidDiagram } from "./MermaidDiagramAdapter";

interface PendingImage extends AiImageUpload { previewUrl: string; }
interface AiWorkspacePanelProps {
  open: boolean;
  workspaceId?: string;
  activeDocument?: CanvasDocument | null;
  activeBridge?: AiCanvasBridge;
  onClose: () => void;
}

const adapter = new MermaidDiagramAdapter();
const getError = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

function AiTurnCard({ turn, activeBridge, activeDocumentId, onBase, onRepair, onRefresh }: { turn: AiTurn; activeBridge?: AiCanvasBridge; activeDocumentId?: string; onBase: () => void; onRepair: (parseError: string) => void; onRefresh: () => Promise<void> }) {
  const [diagram, setDiagram] = useState<ConvertedMermaidDiagram | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    if (turn.status !== "ready" || !turn.mermaid) { setDiagram(null); setError(null); return; }
    void adapter.convert(turn.mermaid).then((result) => { if (!disposed) { setDiagram(result); setError(null); } }).catch((reason: unknown) => { if (!disposed) setError(getError(reason, "Mermaid 预览转换失败")); });
    return () => { disposed = true; };
  }, [turn.mermaid, turn.status]);
  useEffect(() => {
    if (!diagram?.svg) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(new Blob([diagram.svg], { type: "image/svg+xml" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [diagram]);
  const insert = async (): Promise<void> => {
    if (!diagram || !activeBridge || !activeDocumentId) return;
    try { activeBridge.insertDiagram(diagram); await window.desktopApi.ai.markTurnInserted(turn.id, activeDocumentId); await onRefresh(); setError(null); }
    catch (reason) { setError(getError(reason, "图表插入失败，当前画布未被修改")); }
  };
  return (
    <article className="ai-turn-card">
      <div className="ai-turn-card__header"><span className="ai-turn-card__prompt">{turn.prompt}</span><span className={`ai-turn-status ai-turn-status--${turn.status}`}>{turn.status === "generating" ? "生成中" : turn.status === "ready" ? "已完成" : turn.status === "error" ? "失败" : "已取消"}</span></div>
      {turn.context?.selection && <span className="ai-context-chip">选区 {turn.context.selection.selectedElementCount ?? turn.context.selection.elementCount} 个元素</span>}
      {turn.attachments.length > 0 && <span className="ai-context-chip"><FileImage size={12} />截图 {turn.attachments.length} 张</span>}
      {turn.status === "generating" && <div className="ai-turn-card__loading"><LoaderCircle className="is-spinning" size={17} />正在请求 LM Studio…</div>}
      {(turn.status === "error" || error) && <div className="ai-panel-error"><AlertCircle size={15} /><span>{error ?? turn.errorMessage ?? "生成失败"}</span>{turn.mermaid && <button className="button button--compact" type="button" onClick={() => onRepair(error ?? turn.errorMessage ?? "Mermaid 转换失败")}><RefreshCw size={14} />AI 修复</button>}</div>}
      {previewUrl && <img className="ai-turn-card__preview" src={previewUrl} alt="Mermaid 图表预览" />}
      {error && <div className="ai-panel-error"><AlertCircle size={15} />{error}</div>}
      {showSource && turn.mermaid && <pre className="ai-turn-card__source">{turn.mermaid}</pre>}
      {turn.status === "ready" && <div className="ai-turn-card__actions">
        <button className="button button--compact" type="button" onClick={() => setShowSource((value) => !value)}><Code2 size={14} />{showSource ? "隐藏 Mermaid" : "查看 Mermaid"}</button>
        <button className="button button--compact" type="button" onClick={onBase}>基于此修改</button>
        <button className="button button--primary button--compact" type="button" disabled={!diagram || !activeBridge || !activeDocumentId} onClick={() => void insert()}>插入当前画布</button>
        {turn.insertedDocumentId && <span className="ai-inserted-mark"><Check size={13} />已插入</span>}
      </div>}
    </article>
  );
}

export function AiWorkspacePanel({ open, workspaceId, activeDocument, activeBridge, onClose }: AiWorkspacePanelProps) {
  const [sessions, setSessions] = useState<AiSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [detail, setDetail] = useState<AiSessionDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedBaseTurnId, setSelectedBaseTurnId] = useState<string | undefined>();
  const [pendingSelection, setPendingSelection] = useState(false);
  const [pendingSelectionImage, setPendingSelectionImage] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<number | undefined>(undefined);

  const refreshSessions = async (): Promise<void> => {
    if (!workspaceId) return;
    const next = await window.desktopApi.ai.listSessions(workspaceId);
    setSessions(next);
    const persisted = localStorage.getItem(`drawspace.ai.active.${workspaceId}`);
    const selected = next.find((session) => session.id === persisted)?.id ?? next[0]?.id;
    if (selected && selected !== activeSessionId) setActiveSessionId(selected);
    if (!selected) {
      const created = await window.desktopApi.ai.createSession({ workspaceId, sourceDocumentId: activeDocument?.id });
      setSessions([created]); setActiveSessionId(created.id);
    }
  };
  const refreshDetail = async (sessionId = activeSessionId): Promise<void> => {
    if (!sessionId) return;
    const next = await window.desktopApi.ai.getSession(sessionId);
    setDetail(next); setDraft(next.draftPrompt);
  };
  useEffect(() => {
    if (!open || !workspaceId) return;
    void refreshSessions().catch((reason) => setPanelError(getError(reason, "无法读取 AI 对话")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);
  useEffect(() => {
    if (!activeSessionId || !workspaceId) return;
    localStorage.setItem(`drawspace.ai.active.${workspaceId}`, activeSessionId);
    void refreshDetail().catch((reason) => setPanelError(getError(reason, "无法读取当前对话")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, workspaceId]);
  useEffect(() => () => { if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current); pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl)); }, [pendingImages]);
  const updateDraft = (value: string): void => {
    setDraft(value);
    if (!activeSessionId) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => { void window.desktopApi.ai.updateSession({ sessionId: activeSessionId, draftPrompt: value }).catch(() => undefined); }, 350);
  };
  const createSession = async (): Promise<void> => {
    if (!workspaceId) return;
    try { const created = await window.desktopApi.ai.createSession({ workspaceId, sourceDocumentId: activeDocument?.id }); setSessions((items) => [created, ...items]); setActiveSessionId(created.id); setPanelError(null); }
    catch (reason) { setPanelError(getError(reason, "新建对话失败")); }
  };
  const renameSession = async (session: AiSessionSummary): Promise<void> => {
    const title = window.prompt("重命名对话", session.title)?.trim();
    if (!title || title === session.title) return;
    try { const updated = await window.desktopApi.ai.updateSession({ sessionId: session.id, title }); setSessions((items) => items.map((item) => item.id === updated.id ? updated : item)); if (detail?.id === updated.id) setDetail((current) => current ? { ...current, ...updated } : current); }
    catch (reason) { setPanelError(getError(reason, "重命名失败")); }
  };
  const deleteSession = async (session: AiSessionSummary): Promise<void> => {
    if (!window.confirm(`确定删除“${session.title}”吗？`)) return;
    try { await window.desktopApi.ai.deleteSession(session.id); const remaining = sessions.filter((item) => item.id !== session.id); setSessions(remaining); setActiveSessionId(remaining[0]?.id); setDetail(null); }
    catch (reason) { setPanelError(getError(reason, "删除对话失败")); }
  };
  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const file = Array.from(files)[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setPanelError("只支持 PNG、JPEG 或 WEBP 图片"); return; }
    if (file.size > 8 * 1024 * 1024) { setPanelError("单张图片不能超过 8 MB"); return; }
    const data = await file.arrayBuffer();
    const previewUrl = URL.createObjectURL(file);
    setPendingImages((items) => { items.forEach((item) => URL.revokeObjectURL(item.previewUrl)); return [{ fileName: file.name || "image", mimeType: file.type as PendingImage["mimeType"], data, previewUrl }]; });
    setPanelError(null);
  };
  const send = async (): Promise<void> => {
    const prompt = draft.trim();
    if (!activeSessionId || !prompt || busy) return;
    const selection = pendingSelection ? activeBridge?.getSelectionContext() : undefined;
    if (pendingSelection && !selection) { setPanelError("当前没有可参考的选区"); return; }
    setBusy(true); setPanelError(null);
    try {
      let selectionImage: AiImageUpload | undefined;
      if (pendingSelectionImage && activeBridge?.exportSelectionPreview) {
        try { selectionImage = await activeBridge.exportSelectionPreview(); }
        catch { setPanelError("选区图片导出失败，将仅发送结构摘要"); }
      }
      const images = pendingImages.length ? pendingImages.map((image) => ({ fileName: image.fileName, mimeType: image.mimeType, data: image.data })) : selectionImage ? [selectionImage] : undefined;
      const mode = selectedBaseTurnId ? "revise" : images ? "reference_image" : pendingSelection ? "extend_selection" : "create";
      await window.desktopApi.ai.generateTurn({ sessionId: activeSessionId, prompt, mode, baseTurnId: selectedBaseTurnId, selection, images });
      setDraft(""); setSelectedBaseTurnId(undefined); setPendingSelection(false); setPendingSelectionImage(false); pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl)); setPendingImages([]);
      await refreshSessions(); await refreshDetail(activeSessionId);
    } catch (reason) { setPanelError(getError(reason, "AI 图表生成失败")); await refreshDetail(activeSessionId).catch(() => undefined); }
    finally { setBusy(false); }
  };
  const repair = async (turn: AiTurn, parseError = turn.errorMessage): Promise<void> => {
    if (!activeSessionId || !parseError || busy) return;
    setBusy(true); setPanelError(null);
    try { await window.desktopApi.ai.repairTurn({ sessionId: activeSessionId, turnId: turn.id, prompt: turn.prompt, parseError }); await refreshSessions(); await refreshDetail(activeSessionId); }
    catch (reason) { setPanelError(getError(reason, "AI 修复失败")); }
    finally { setBusy(false); }
  };
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => { const file = Array.from(event.clipboardData.files)[0]; if (file) { event.preventDefault(); void addFiles([file]); } };
  const selectionAvailable = Boolean(activeBridge?.getSelectionContext());
  return (
    <aside className={`ai-workspace-panel ${open ? "is-open" : "is-closed"}`} aria-hidden={!open}>
      <header className="ai-workspace-panel__header"><div><strong>AI 图表助手</strong><span>工作区级会话 · LM Studio</span></div><button className="editor-icon-button" type="button" aria-label="关闭 AI 面板" onClick={onClose}><X size={18} /></button></header>
      <div className="ai-workspace-panel__body">
        <nav className="ai-conversation-sidebar" aria-label="AI 对话列表"><button className="button button--primary button--compact ai-new-session" type="button" onClick={() => void createSession()}><Plus size={15} />新建对话</button><div className="ai-session-list">{sessions.map((session) => <div className={`ai-session-item ${session.id === activeSessionId ? "is-active" : ""}`} key={session.id}><button type="button" onClick={() => setActiveSessionId(session.id)}><strong>{session.title}</strong><small>{session.latestPrompt ?? "尚未发送消息"}</small><small>{session.sourceDocumentName ? `来源：${session.sourceDocumentName}` : "工作区会话"}</small></button><div className="ai-session-item__actions"><button type="button" aria-label="重命名" onClick={() => void renameSession(session)}><MoreHorizontal size={14} /></button><button type="button" aria-label="删除" onClick={() => void deleteSession(session)}><Trash2 size={13} /></button></div></div>)}</div></nav>
        <section className="ai-conversation-view"><div className="ai-conversation-view__meta"><span>{detail?.title ?? "新对话"}</span>{activeDocument && <small>当前插入目标：{activeDocument.name}</small>}</div><div className="ai-turn-list">{detail?.turns.length ? detail.turns.map((turn) => <AiTurnCard key={turn.id} turn={turn} activeBridge={activeBridge} activeDocumentId={activeDocument?.id} onBase={() => { setSelectedBaseTurnId(turn.id); updateDraft(draft); }} onRepair={(parseError) => void repair(turn, parseError)} onRefresh={() => refreshDetail()} />) : <div className="ai-empty-state"><FileImage size={22} /><p>描述你想生成的图表，或附加一张截图。</p><small>历史 Mermaid 会保存在当前工作区。</small></div>}</div><div className="ai-composer" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}><div className="ai-composer__chips">{selectedBaseTurnId && <button type="button" className="ai-context-chip" onClick={() => setSelectedBaseTurnId(undefined)}>基于历史结果修改 <X size={12} /></button>}{pendingSelection && <button type="button" className="ai-context-chip" onClick={() => { setPendingSelection(false); setPendingSelectionImage(false); }}>参考当前选区 <X size={12} /></button>}{pendingSelectionImage && <span className="ai-context-chip">选区外观</span>}{pendingImages.map((image) => <button type="button" className="ai-context-chip" key={image.previewUrl} onClick={() => { URL.revokeObjectURL(image.previewUrl); setPendingImages([]); }}>{image.fileName}<X size={12} /></button>)}</div><textarea value={draft} onChange={(event) => updateDraft(event.target.value)} onPaste={handlePaste} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} placeholder="描述要生成或修改的内容…" disabled={busy || !detail} /><div className="ai-composer__footer"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} /><button className="button button--compact" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><FileImage size={15} />添加截图</button><button className={`button button--compact ${pendingSelection ? "is-active" : ""}`} type="button" disabled={!selectionAvailable || busy} onClick={() => { const next = !pendingSelection; setPendingSelection(next); if (!next) setPendingSelectionImage(false); }}>参考选区</button>{pendingSelection && <button className={`button button--compact ${pendingSelectionImage ? "is-active" : ""}`} type="button" disabled={busy} onClick={() => setPendingSelectionImage((value) => !value)}>同时参考选区外观</button>}<button className="button button--primary button--compact" type="button" disabled={busy || !draft.trim() || !detail} onClick={() => void send()}><Send size={15} />发送</button></div></div>{panelError && <div className="ai-panel-error ai-panel-error--global"><AlertCircle size={15} /><span>{panelError}</span><button type="button" onClick={() => setPanelError(null)}><X size={14} /></button></div>}</section>
      </div>
    </aside>
  );
}
