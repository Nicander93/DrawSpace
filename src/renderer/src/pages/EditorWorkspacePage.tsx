import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { AppCloseRequest, CanvasDocument, DocumentContent } from "@shared/types";
import { Brand } from "../components/Brand";
import { EditorTabs } from "../components/EditorTabs";
import { WindowControls } from "../components/WindowControls";
import { EditorPage } from "./EditorPage";
import { useEditorStore } from "../stores/editorStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAiWorkspaceStore } from "../stores/aiWorkspaceStore";
import { DocumentPicker } from "../components/DocumentPicker";
import { Modal } from "../components/Modal";
import { UnsavedDocumentsDialog } from "../components/UnsavedDocumentsDialog";
import { ArrowLeft, Check, Circle, FileWarning, LoaderCircle, RefreshCw } from "lucide-react";
import { useAppCloseHandler } from "../features/lifecycle/AppCloseContext";
import { AiWorkspacePanel } from "../features/ai/AiWorkspacePanel";
import type { AiCanvasBridge } from "../features/ai/AiCanvasBridge";
import { aiCanvasRegistry } from "../features/ai/canvas/AiCanvasRegistry";
import { useAiCanvasBridge } from "../features/ai/canvas/useAiCanvasBridge";

interface EditorLocationState { initialContent?: DocumentContent; isDraft?: boolean }

export function EditorWorkspacePage({ visible = true }: { visible?: boolean }) {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const documents = useWorkspaceStore((state) => state.documents);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const refreshWorkspace = useWorkspaceStore((state) => state.refresh);
  const { tabs, activeDocumentId, openDocument, activateDocument, closeDocument, reorderTabs } = useEditorStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeIntent, setCloseIntent] = useState<"exit" | "workspace" | "tabs">("exit");
  const [pendingTabCloseIds, setPendingTabCloseIds] = useState<string[] | null>(null);
  const [closeDialogTabs, setCloseDialogTabs] = useState<typeof tabs>([]);
  const [tabMenu, setTabMenu] = useState<{ tab: (typeof tabs)[number]; x: number; y: number } | null>(null);
  const [renamingTab, setRenamingTab] = useState<(typeof tabs)[number] | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const aiPanelOpen = useAiWorkspaceStore((state) => state.panelOpen);
  const closeAiPanel = useAiWorkspaceStore((state) => state.closePanel);
  const saveHandlersRef = useRef(new Map<string, () => Promise<boolean>>());
  const closeHandlersRef = useRef(new Map<string, () => Promise<void>>());
  const discardHandlersRef = useRef(new Map<string, () => Promise<void>>());
  const closeRequestIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const activeTab = tabs.find((tab) => tab.documentId === activeDocumentId) ?? null;
  const activeAiBridge = useAiCanvasBridge(activeDocumentId ?? undefined);

  const registerAiBridge = useCallback((id: string, bridge: AiCanvasBridge) => {
    return aiCanvasRegistry.register(id, bridge);
  }, []);

  const openTab = useCallback(async (document: CanvasDocument, content?: DocumentContent, isDraft = false) => {
    openDocument({
      documentId: document.id,
      name: document.name,
      relativePath: document.relativePath,
      isFavorite: document.isFavorite,
      isDraft
    });
    activateDocument(document.id);
    if (isDraft) useEditorStore.getState().updateSaveStatus(document.id, "dirty");
    navigate(`/editor/${document.id}`, { replace: true, state: content ? { initialContent: content, isDraft } : undefined });
    setPickerOpen(false);
  }, [activateDocument, navigate, openDocument]);

  useEffect(() => {
    if (!hydratedRef.current && documents.length > 0) {
      hydratedRef.current = true;
      useEditorStore.getState().hydrate(documents);
    }
  }, [documents]);

  useEffect(() => {
    if (!documentId) return;
    const state = location.state as EditorLocationState | null;
    const document = documents.find((item) => item.id === documentId);
    if (document) {
      openDocument({ documentId: document.id, name: document.name, relativePath: document.relativePath, isFavorite: document.isFavorite, isDraft: state?.isDraft });
      activateDocument(document.id);
      if (state?.isDraft) useEditorStore.getState().updateSaveStatus(document.id, "dirty");
      return;
    }
    void window.desktopApi.documents.open(documentId).then((content) => {
      void openTab(content.document, state?.initialContent ?? content, state?.isDraft);
    });
  }, [activateDocument, documentId, documents, location.state, openDocument, openTab]);

  useEffect(() => {
    if (!visible) return;
    if (activeDocumentId) navigate(`/editor/${activeDocumentId}`, { replace: true });
  }, [activeDocumentId, navigate, visible]);

  const activate = useCallback((id: string) => {
    if (activeDocumentId && activeDocumentId !== id) {
      void saveHandlersRef.current.get(activeDocumentId)?.();
    }
    activateDocument(id);
    navigate(`/editor/${id}`, { replace: true });
  }, [activeDocumentId, activateDocument, navigate]);

  const closeTabsWithGuard = useCallback(async (ids: string[]) => {
    const currentTabs = useEditorStore.getState().tabs;
    const unsavedIds = ids.filter((id) => currentTabs.find((tab) => tab.documentId === id)?.saveStatus !== "saved");
    if (unsavedIds.length > 0) {
      setCloseDialogTabs(currentTabs.filter((tab) => unsavedIds.includes(tab.documentId)));
      setPendingTabCloseIds(ids);
      setCloseIntent("tabs");
      setCloseError(null);
      setCloseDialogOpen(true);
      setTabMenu(null);
      return;
    }
    await Promise.all(ids.map((id) => closeHandlersRef.current.get(id)?.() ?? Promise.resolve()));
    ids.forEach((id) => useEditorStore.getState().closeDocument(id));
    setTabMenu(null);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyboard = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (modifier && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPickerOpen(true);
        return;
      }
      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void window.desktopApi.documents.create().then((content) => openTab(content.document, content, true));
        return;
      }
      if (modifier && event.key.toLowerCase() === "w" && activeDocumentId) {
        event.preventDefault();
        void closeTabsWithGuard([activeDocumentId]);
        return;
      }
      if (modifier && event.key.toLowerCase() === "tab" && tabs.length > 1) {
        event.preventDefault();
        const index = tabs.findIndex((tab) => tab.documentId === activeDocumentId);
        const direction = event.shiftKey ? -1 : 1;
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        if (next) activate(next.documentId);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [activeDocumentId, activate, closeTabsWithGuard, openTab, tabs, visible]);

  const handleAppClose = useCallback((request: AppCloseRequest) => {
    if (!visible) return;
    closeRequestIdRef.current = request.requestId;
    const hasUnsaved = tabs.some((tab) =>
      tab.saveStatus === "dirty" || tab.saveStatus === "saving" || tab.saveStatus === "error" || tab.saveStatus === "conflict"
    );
    if (hasUnsaved) {
      setCloseDialogTabs(tabs.filter((tab) => tab.saveStatus !== "saved"));
      setCloseError(null);
      setCloseIntent("exit");
      setCloseDialogOpen(true);
      return;
    }
    void Promise.all(
      tabs.map((tab) => closeHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve())
    )
      .then(() => window.desktopApi.lifecycle.respondToClose({ requestId: request.requestId, decision: "proceed" }))
      .catch(() => window.desktopApi.lifecycle.respondToClose({ requestId: request.requestId, decision: "cancel" }));
  }, [tabs, visible]);

  useAppCloseHandler(handleAppClose, visible);


  const registerSave = useCallback((id: string, save: () => Promise<boolean>) => {
    saveHandlersRef.current.set(id, save);
    return () => saveHandlersRef.current.delete(id);
  }, []);

  const registerClose = useCallback((id: string, closeSession: () => Promise<void>) => {
    closeHandlersRef.current.set(id, closeSession);
    return () => closeHandlersRef.current.delete(id);
  }, []);

  const registerDiscard = useCallback((id: string, discard: () => Promise<void>) => {
    discardHandlersRef.current.set(id, discard);
    return () => discardHandlersRef.current.delete(id);
  }, []);

  const closeAllSessions = useCallback(async () => {
    await Promise.all(
      tabs.map((tab) => closeHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve())
    );
  }, [tabs]);

  useEffect(() => {
    if (closeError) setCloseBusy(false);
  }, [closeError]);

  const discardAndExit = useCallback(() => {
    if (closeBusy) return;
    setCloseBusy(true);
    setCloseError(null);
    const targetTabs = closeIntent === "tabs"
      ? tabs.filter((tab) => pendingTabCloseIds?.includes(tab.documentId))
      : tabs;
    void Promise.all(targetTabs.map((tab) => window.desktopApi.recovery.discard(tab.documentId)))
      .then(() => Promise.all(targetTabs.map((tab) => discardHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve())))
      .then(() => closeIntent === "workspace" ? undefined : Promise.all(targetTabs.map((tab) => closeHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve())))
      .then(() => {
        if (closeIntent === "workspace") {
          setCloseDialogOpen(false);
          navigate("/");
          return;
        }
        if (closeIntent === "tabs") {
          targetTabs.forEach((tab) => useEditorStore.getState().closeDocument(tab.documentId));
          setPendingTabCloseIds(null);
          setCloseDialogOpen(false);
          return;
        }
        const requestId = closeRequestIdRef.current;
        if (requestId) window.desktopApi.lifecycle.respondToClose({ requestId, decision: "proceed" });
      })
      .finally(() => setCloseBusy(false))
      .catch((error) => setCloseError(error instanceof Error ? error.message : "无法清理恢复快照"));
  }, [closeBusy, closeIntent, navigate, pendingTabCloseIds, tabs]);

  const saveAllAndExit = useCallback(() => {
    if (closeBusy) return;
    setCloseBusy(true);
    setCloseError(null);
    const targetTabs = closeIntent === "tabs"
      ? tabs.filter((tab) => pendingTabCloseIds?.includes(tab.documentId))
      : tabs;
    void Promise.all(targetTabs.map((tab) => saveHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve(true)))
      .then((results) => {
        if (results.every(Boolean)) {
          if (closeIntent === "tabs") {
            return Promise.all(targetTabs.map((tab) => closeHandlersRef.current.get(tab.documentId)?.() ?? Promise.resolve()))
              .then(() => targetTabs.forEach((tab) => useEditorStore.getState().closeDocument(tab.documentId)))
              .then(() => { setPendingTabCloseIds(null); setCloseDialogOpen(false); setCloseBusy(false); });
          }
          if (closeIntent === "workspace") {
            setCloseDialogOpen(false);
            setCloseBusy(false);
            navigate("/");
            return;
          }
          return closeAllSessions().then(() => {
            const requestId = closeRequestIdRef.current;
            if (requestId) window.desktopApi.lifecycle.respondToClose({ requestId, decision: "proceed" });
          });
        }
        setCloseError("部分画布保存失败，请重试或选择放弃修改。");
      })
      .catch((error) => setCloseError(error instanceof Error ? error.message : "保存失败"));
  }, [closeAllSessions, closeBusy, closeIntent, navigate, pendingTabCloseIds, tabs]);

  const cancelExit = useCallback(() => {
    if (closeBusy) return;
    setCloseDialogOpen(false);
    setCloseError(null);
    setPendingTabCloseIds(null);
    if (closeIntent === "workspace") return;
    const requestId = closeRequestIdRef.current;
    if (requestId) window.desktopApi.lifecycle.respondToClose({ requestId, decision: "cancel" });
  }, [closeBusy, closeIntent]);

  const returnToWorkspace = useCallback(() => {
    const hasUnsaved = tabs.some((tab) => tab.saveStatus !== "saved");
    if (hasUnsaved) {
      setCloseDialogTabs(tabs.filter((tab) => tab.saveStatus !== "saved"));
      setCloseIntent("workspace");
      setCloseError(null);
      setCloseDialogOpen(true);
      return;
    }
    navigate("/");
  }, [navigate, tabs]);

  const requestRename = useCallback((tab: (typeof tabs)[number]) => {
    activate(tab.documentId);
    setRenameDraft(tab.name);
    setRenameError(null);
    setRenamingTab(tab);
  }, [activate]);

  const submitRename = useCallback(async () => {
    if (!renamingTab || renameBusy) return;
    const name = renameDraft.trim();
    if (!name || name === renamingTab.name) {
      setRenamingTab(null);
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const updated = await window.desktopApi.documents.rename(renamingTab.documentId, name);
      useEditorStore.getState().updateDocumentMetadata({
        documentId: updated.id,
        name: updated.name,
        relativePath: updated.relativePath,
        isFavorite: updated.isFavorite
      });
      await refreshWorkspace();
      setRenamingTab(null);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setRenameBusy(false);
    }
  }, [refreshWorkspace, renameBusy, renameDraft, renamingTab]);
  const handleTabContextMenu = useCallback((tab: (typeof tabs)[number], event: React.MouseEvent) => {
    setTabMenu({ tab, x: event.clientX, y: event.clientY });
  }, []);

  return (
    <div className="editor-workspace">
      <header className="editor-workspace__titlebar">
        <Brand compact />
        <button
          className="editor-workspace__back"
          type="button"
          title="返回工作区"
          onClick={returnToWorkspace}
        >
          <ArrowLeft size={16} />
          <span>工作区</span>
        </button>
        <EditorTabs
          tabs={tabs}
          activeDocumentId={activeDocumentId}
          onActivate={activate}
          onClose={(id) => { void closeTabsWithGuard([id]); }}
          onAdd={() => setPickerOpen(true)}
          onReorder={reorderTabs}
          onRename={requestRename}
          onContextMenu={handleTabContextMenu}
        />
        {activeTab && (
          <div
            className={`editor-workspace__save-status editor-workspace__save-status--${activeTab.saveStatus}`}
            title={activeTab.saveError ?? undefined}
          >
            {activeTab.saveStatus === "saving" && <LoaderCircle size={13} className="is-spinning" />}
            {activeTab.saveStatus === "dirty" && <Circle size={10} fill="currentColor" />}
            {(activeTab.saveStatus === "error" || activeTab.saveStatus === "conflict") && <FileWarning size={13} />}
            {activeTab.saveStatus === "saved" && <Check size={13} />}
            <span>{activeTab.saveStatus === "saved" ? "已保存" : activeTab.saveStatus === "saving" ? "正在保存" : activeTab.saveStatus === "dirty" ? "未保存" : activeTab.saveStatus === "conflict" ? "已创建冲突副本" : "保存失败"}</span>
            {activeTab.saveStatus === "error" && (
              <button
                type="button"
                aria-label="重试保存"
                onClick={() => void saveHandlersRef.current.get(activeTab.documentId)?.()}
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        )}
        <WindowControls />
      </header>
      <div className="editor-workbench">
        <div className="editor-document-host">
          {tabs.map((tab) => (
            <div className={`editor-document-pane ${tab.documentId === activeDocumentId ? "is-active" : ""}`} inert={tab.documentId !== activeDocumentId ? true : undefined} key={tab.documentId}>
              <EditorPage documentId={tab.documentId} isDraft={tab.isDraft} embedded active={tab.documentId === activeDocumentId} registerSave={registerSave} registerClose={registerClose} registerDiscard={registerDiscard} onClose={() => closeDocument(tab.documentId)} aiPanelOpen={aiPanelOpen} registerAiBridge={registerAiBridge} />
            </div>
          ))}
          {tabs.length === 0 && <div className="editor-empty"><p>还没有打开的画布</p><button className="button button--primary" type="button" onClick={() => setPickerOpen(true)}>打开画布</button></div>}
        </div>
        <AiWorkspacePanel open={aiPanelOpen} workspaceId={workspace?.id} activeDocument={activeTab ? documents.find((document) => document.id === activeTab.documentId) : null} activeBridge={activeAiBridge} onClose={closeAiPanel} />
      </div>
      {pickerOpen && (
        <DocumentPicker
          documents={documents}
          tabs={tabs}
          onOpen={(document) => void openTab(document)}
          onCreate={() => {
            void window.desktopApi.documents
              .create()
              .then((content) => openTab(content.document, content, true));
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {closeDialogOpen && (
        <UnsavedDocumentsDialog intent={closeIntent} tabs={closeDialogTabs} error={closeError} busy={closeBusy} onSaveAll={saveAllAndExit} onDiscard={discardAndExit} onCancel={cancelExit} />
      )}
      {renamingTab && (
        <Modal
          title="重命名画布"
          onClose={() => { if (!renameBusy) setRenamingTab(null); }}
          footer={<>
            <button className="button" type="button" disabled={renameBusy} onClick={() => setRenamingTab(null)}>取消</button>
            <button className="button button--primary" type="button" disabled={renameBusy} onClick={() => void submitRename()}>{renameBusy ? "处理中…" : "确定"}</button>
          </>}
        >
          <label className="field">
            <span>画布名称</span>
            <input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void submitRename(); }}
            />
          </label>
          {renameError && <p className="inline-error">{renameError}</p>}
        </Modal>
      )}
      {tabMenu && (
        <div className="context-menu editor-tab-context-menu" style={{ left: tabMenu.x, top: tabMenu.y }} onMouseLeave={() => setTabMenu(null)}>
          <button type="button" onClick={() => { requestRename(tabMenu.tab); setTabMenu(null); }}>重命名</button>
          <button type="button" onClick={() => { void closeTabsWithGuard([tabMenu.tab.documentId]); }}>关闭</button>
          <button type="button" onClick={() => { void closeTabsWithGuard(tabs.filter((tab) => tab.documentId !== tabMenu.tab.documentId).map((tab) => tab.documentId)); }}>关闭其他标签</button>
          <button type="button" onClick={() => { const index = tabs.findIndex((tab) => tab.documentId === tabMenu.tab.documentId); void closeTabsWithGuard(tabs.slice(index + 1).map((tab) => tab.documentId)); }}>关闭右侧标签</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(tabMenu.tab.relativePath); setTabMenu(null); }}>复制相对路径</button>
          <button type="button" onClick={() => { void window.desktopApi.documents.reveal(tabMenu.tab.documentId); setTabMenu(null); }}>在文件管理器中显示</button>
        </div>
      )}
    </div>
  );
}
