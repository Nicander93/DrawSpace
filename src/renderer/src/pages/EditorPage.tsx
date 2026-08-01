import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileJson,
  FileWarning,
  Image,
  LoaderCircle,
  MoreHorizontal,
  RefreshCw,
  Save,
  Star
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  CanvasDocument,
  DocumentContent,
  ExcalidrawFile
} from "@shared/types";
import {
  type CanvasScene,
  ExcalidrawAdapter
} from "../features/editor/ExcalidrawAdapter";
import { WindowControls } from "../components/WindowControls";
import { UnsavedDocumentDialog } from "../components/UnsavedDocumentDialog";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useEditorStore } from "../stores/editorStore";
import { DocumentSaveCoordinator } from "../features/editor/DocumentSaveCoordinator";
import type { SaveOutcome, SaveSnapshot } from "../features/editor/saveTypes";
import { useTheme } from "../features/theme/ThemeContext";

type SaveStatus = "saved" | "saving" | "dirty" | "error" | "conflict";

interface EditorLocationState {
  initialContent?: DocumentContent;
  isDraft?: boolean;
}

const adapter = new ExcalidrawAdapter();

interface EditorPageProps {
  documentId?: string;
  isDraft?: boolean;
  embedded?: boolean;
  active?: boolean;
  onClose?: () => void;
  registerSave?: (documentId: string, save: () => Promise<boolean>) => () => void;
  registerClose?: (documentId: string, close: () => Promise<void>) => () => void;
  registerDiscard?: (documentId: string, discard: () => Promise<void>) => () => void;
}

export function EditorPage({ documentId: embeddedDocumentId, isDraft = false, embedded = false, active = true, onClose, registerSave, registerClose, registerDiscard }: EditorPageProps) {
  const routeParams = useParams();
  const documentId = embeddedDocumentId ?? routeParams.documentId;
  const location = useLocation();
  const navigate = useNavigate();
  const refreshWorkspace = useWorkspaceStore((state) => state.refresh);
  const updateDocumentMetadata = useEditorStore((state) => state.updateDocumentMetadata);
  const replaceEditorDocument = useEditorStore((state) => state.replaceDocumentId);
  const updateSaveStatus = useEditorStore((state) => state.updateSaveStatus);
  const updateDraftStatus = useEditorStore((state) => state.updateDraftStatus);
  const { theme } = useTheme();
  const locationState = location.state as EditorLocationState | null;
  const initialContent =
    locationState?.initialContent &&
    locationState.initialContent.document.id === documentId
      ? locationState.initialContent
      : null;
  const initialIsDraft = Boolean(isDraft || (locationState?.isDraft && initialContent));
  const [documentContent, setDocumentContent] =
    useState<DocumentContent | null>(initialContent);
  const [document, setDocument] = useState<CanvasDocument | null>(
    documentContent?.document ?? null
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialIsDraft ? "dirty" : "saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void | Promise<void>) | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(document?.name ?? "");
  const sceneRef = useRef<ExcalidrawFile | null>(
    documentContent?.sceneData ?? null
  );
  const serializedSceneRef = useRef<string | null>(null);

  const sceneRuntimeRef = useRef<CanvasScene | null>(null);
  const versionRef = useRef(documentContent?.version ?? "");
  const sessionIdRef = useRef(documentContent?.sessionId ?? "");
  const dirtyRef = useRef(initialIsDraft);
  const draftRef = useRef(initialIsDraft);
  const revisionRef = useRef(0);
  const saveCoreRef = useRef<((snapshot: SaveSnapshot) => Promise<boolean>) | null>(null);
  const saveOutcomeRef = useRef<SaveOutcome | null>(null);
  const editorReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const saveCoordinator = useMemo(
    () => new DocumentSaveCoordinator({
      documentId: documentId ?? "",
      getScene: () => sceneRef.current,
      getExpectedVersion: () => versionRef.current,
      executeSave: async (snapshot) => {
        const save = saveCoreRef.current;
        if (!save) return { status: "failed" as const, message: "保存器尚未初始化" };
        saveOutcomeRef.current = null;
        const saved = await save(snapshot);
        if (saveOutcomeRef.current) return saveOutcomeRef.current;
        return saved ? { status: "saved" as const } : { status: "failed" as const, message: "保存失败" };
      },
      onStatusChange: (status, error) => {
        if (!mountedRef.current) return;
        setSaveStatus(status);
        setSaveError(error);
      }
    }),
    [documentId]
  );

  useEffect(() => {
    saveCoordinator.activate();
    return () => saveCoordinator.dispose();
  }, [saveCoordinator]);

  useEffect(() => {
    mountedRef.current = true;
    if (!documentId) return;
    if (documentContent?.document.id === documentId) {
      return () => {
        mountedRef.current = false;
      };
    }
    void window.desktopApi.documents
      .open(documentId)
      .then((content) => {
        if (!mountedRef.current) return;
        setDocumentContent(content);
        setDocument(content.document);
        setNameDraft(content.document.name);
        sceneRef.current = content.sceneData;
        serializedSceneRef.current = null;
        sceneRuntimeRef.current = null;
        versionRef.current = content.version;
        sessionIdRef.current = content.sessionId;
        dirtyRef.current = false;
        revisionRef.current = 0;
        editorReadyRef.current = false;
      })
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : "无法打开画布");
        setSaveStatus("error");
      });
    return () => {
      mountedRef.current = false;
    };
  }, [documentContent?.document.id, documentId]);

  const saveRecoverySnapshot = useCallback(async () => {
    if (!document || !sceneRef.current || !sessionIdRef.current) return;
    await window.desktopApi.recovery.save({
      documentId: document.id,
      sourcePath: document.relativePath,
      savedAt: Date.now(),
      sourceModifiedAt: document.modifiedAt,
      sceneData: sceneRef.current,
      sessionId: sessionIdRef.current
    });
  }, [document]);

  const saveThumbnail = useCallback(async () => {
    if (!document || !sceneRuntimeRef.current) return;
    try {
      const thumbnail = await adapter.renderThumbnail(sceneRuntimeRef.current);
      await window.desktopApi.documents.saveThumbnail(
        document.id,
        await thumbnail.arrayBuffer()
      );
    } catch {
      return;
    }
  }, [document]);

  const performSaveOnce = useCallback(
    async (force = false, snapshot?: SaveSnapshot): Promise<boolean> => {
      if (!document || !sceneRef.current) return false;
      if (!dirtyRef.current && !force && !snapshot) return true;
      if (!dirtyRef.current && force && !snapshot) return true;
      const revisionToSave = snapshot?.revision ?? revisionRef.current;
      const sceneDataToSave = snapshot?.sceneData ?? sceneRef.current;
      const saveOperation = (async (): Promise<boolean> => {
        setSaveStatus("saving");
        setSaveError(null);
        const result = await window.desktopApi.documents.save({
          documentId: document.id,
          sceneData: sceneDataToSave,
          expectedVersion: snapshot?.expectedVersion ?? versionRef.current
        });
        if (result.status === "conflict") {
          saveOutcomeRef.current = { status: "conflict", persisted: false, message: result.message };
          dirtyRef.current = revisionRef.current !== revisionToSave;
          setSaveStatus("conflict");
          setSaveError(result.message);
          await window.desktopApi.sessions.close(sessionIdRef.current);
          let conflictContent = await window.desktopApi.documents.open(
            result.conflictDocument.id
          );
          let conflictStatus: SaveStatus = "conflict";
          let conflictError: string | null = result.message;
          if (dirtyRef.current && sceneRef.current) {
            const latestResult = await window.desktopApi.documents.save({
              documentId: conflictContent.document.id,
              sceneData: sceneRef.current,
              expectedVersion: conflictContent.version
            });
            if (latestResult.status === "saved") {
              conflictContent = {
                ...conflictContent,
                document: latestResult.document,
                sceneData: sceneRef.current,
                version: latestResult.version
              };
              dirtyRef.current = false;
              conflictStatus = "saved";
              conflictError = null;
            } else {
              conflictStatus = "error";
              conflictError = latestResult.message;
              await saveRecoverySnapshot().catch(() => undefined);
            }
          }
          replaceEditorDocument(document.id, {
            documentId: conflictContent.document.id,
            name: conflictContent.document.name,
            relativePath: conflictContent.document.relativePath,
            isFavorite: conflictContent.document.isFavorite
          }, conflictStatus, conflictError);
          // The tab id replacement remounts this pane. Let the replacement
          // pane own the newly opened conflict session instead of closing it
          // from the old pane's unmount cleanup.
          sessionIdRef.current = "";
          setDocumentContent(conflictContent);
          setDocument(conflictContent.document);
          setNameDraft(conflictContent.document.name);
          sceneRef.current = conflictContent.sceneData;
          serializedSceneRef.current = null;
          sceneRuntimeRef.current = null;
          versionRef.current = conflictContent.version;
          sessionIdRef.current = conflictContent.sessionId;
          revisionRef.current = 0;
          editorReadyRef.current = false;
          navigate(`/editor/${result.conflictDocument.id}`, {
            replace: true,
            state: { initialContent: conflictContent }
          });
          return false;
        }
        versionRef.current = result.version;
        setDocument(result.document);
        draftRef.current = false;
        updateDraftStatus(result.document.id, false);
        dirtyRef.current = revisionRef.current !== revisionToSave;
        setSaveStatus(dirtyRef.current ? "dirty" : "saved");
        void saveThumbnail();
        return true;
      })();
      try {
        const saved = await saveOperation;
        return saved && !dirtyRef.current;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "保存失败");
        setSaveStatus("error");
        setSaveError(message);
        await saveRecoverySnapshot().catch(() => undefined);
        return false;
      }
    },
    [document, navigate, replaceEditorDocument, saveRecoverySnapshot, saveThumbnail, updateDraftStatus]
  );

  saveCoreRef.current = (snapshot) => performSaveOnce(true, snapshot);

  const performSave = useCallback((force = false): Promise<boolean> => {
    const reason = force ? "manual" : "auto-debounce";
    return saveCoordinator.requestSave(reason).then((outcome) =>
      outcome.status === "saved" || outcome.status === "noop"
    );
  }, [saveCoordinator]);

  useEffect(() => {
    if (!embedded || !document || !registerSave) return;
    return registerSave(document.id, () => performSave(true));
  }, [document, embedded, performSave, registerSave]);

  const closeSession = useCallback(async () => {
    if (sessionIdRef.current) {
      await window.desktopApi.sessions.close(sessionIdRef.current);
      sessionIdRef.current = "";
    }
  }, []);

  useEffect(() => {
    if (!embedded || !document || !registerClose) return;
    return registerClose(document.id, closeSession);
  }, [closeSession, document, embedded, registerClose]);

  const discardChanges = useCallback(async () => {
    dirtyRef.current = false;
    saveCoordinator.dispose();
    setSaveStatus("saved");
    if (draftRef.current && document) {
      await closeSession();
      await window.desktopApi.documents.trash(document.id);
      await window.desktopApi.documents.deletePermanently(document.id);
      draftRef.current = false;
      await refreshWorkspace();
    }
  }, [closeSession, document, refreshWorkspace, saveCoordinator]);

  useEffect(() => {
    if (!embedded || !document || !registerDiscard) return;
    return registerDiscard(document.id, discardChanges);
  }, [discardChanges, document, embedded, registerDiscard]);

  useEffect(() => {
    const recoveryTimer = window.setInterval(() => {
      if (dirtyRef.current) {
        void saveRecoverySnapshot();
      }
    }, 10_000);
    return () => window.clearInterval(recoveryTimer);
  }, [saveRecoverySnapshot]);

  const finishLeave = useCallback(async (continueAction: () => void | Promise<void>) => {
    await closeSession();
    await continueAction();
  }, [closeSession]);

  const requestLeaveDocument = useCallback(async (continueAction: () => void | Promise<void>) => {
    if (saveStatus === "saving") {
      const saved = await performSave(true);
      if (saved && !dirtyRef.current) {
        await finishLeave(continueAction);
        return;
      }
    }
    if (dirtyRef.current || saveStatus === "error" || saveStatus === "conflict") {
      setLeaveError(saveError);
      setPendingLeave(() => continueAction);
      return;
    }
    await finishLeave(continueAction);
  }, [finishLeave, performSave, saveError, saveStatus]);

  const saveAndLeave = useCallback(() => {
    if (!pendingLeave) return;
    setLeaveBusy(true);
    void performSave(true).then(async (saved) => {
      if (!saved || dirtyRef.current) {
        setLeaveError(saveError ?? "保存失败，请重试或选择不保存");
        return;
      }
      const action = pendingLeave;
      setPendingLeave(null);
      await finishLeave(action);
    }).catch((error) => {
      setLeaveError(error instanceof Error ? error.message : "保存失败，请重试或选择不保存");
    }).finally(() => setLeaveBusy(false));
  }, [finishLeave, pendingLeave, performSave, saveError]);

  const discardAndLeave = useCallback(() => {
    if (!pendingLeave) return;
    const action = pendingLeave;
    setPendingLeave(null);
    void window.desktopApi.recovery.discard(document?.id ?? "").catch(() => undefined)
      .then(() => discardChanges())
      .then(() => finishLeave(action));
  }, [discardChanges, document?.id, finishLeave, pendingLeave]);

  const cancelLeave = useCallback(() => {
    if (leaveBusy) return;
    setPendingLeave(null);
    setLeaveError(null);
  }, [leaveBusy]);

  const returnToWorkspace = useCallback(async () => {
    await requestLeaveDocument(async () => {
      await refreshWorkspace();
      navigate("/");
    });
  }, [navigate, refreshWorkspace, requestLeaveDocument]);

  const closeEmbeddedDocument = useCallback(async () => {
    await requestLeaveDocument(() => onClose?.());
  }, [onClose, requestLeaveDocument]);

  useEffect(() => {
    if (!active) return;
    const handleKeyboard = (event: KeyboardEvent): void => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (isModifier && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void (async () => {
          if (document && (await performSave(true))) {
            await window.desktopApi.documents.exportFile(document.id);
          }
        })();
      } else if (isModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void performSave(true);
      }
      if (isModifier && event.key.toLowerCase() === "w" && !embedded) {
        event.preventDefault();
        void returnToWorkspace();
      }
    };
    window.addEventListener("keydown", handleKeyboard, true);
    return () => window.removeEventListener("keydown", handleKeyboard, true);
  }, [active, closeEmbeddedDocument, document, embedded, onClose, performSave, returnToWorkspace]);

  useEffect(() => {
    if (!embedded || !document) return;
    const handleCloseRequest = (event: Event): void => {
      const requestedId = (event as CustomEvent<string>).detail;
      if (requestedId === document.id) void closeEmbeddedDocument();
    };
    window.addEventListener("drawspace:request-close", handleCloseRequest);
    return () => window.removeEventListener("drawspace:request-close", handleCloseRequest);
  }, [closeEmbeddedDocument, document, embedded]);

  useEffect(() => {
    if (!document) return;
    updateDocumentMetadata({
      documentId: document.id,
      name: document.name,
      relativePath: document.relativePath,
      isFavorite: document.isFavorite
    });
  }, [document, updateDocumentMetadata]);

  useEffect(() => {
    if (document) updateSaveStatus(document.id, saveStatus, saveError);
  }, [document, saveError, saveStatus, updateSaveStatus]);

  useEffect(
    () => () => {
      if (dirtyRef.current) {
        void saveRecoverySnapshot();
      } else if (sessionIdRef.current) {
        void window.desktopApi.sessions.close(sessionIdRef.current).catch(() => undefined);
      }
    },
    [saveRecoverySnapshot]
  );

  const handleSceneChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ): void => {
    if (!documentContent) return;
    const scene = { elements, appState, files };
    const serializedScene = adapter.serializeScene(scene);
    sceneRuntimeRef.current = scene;
    if (serializedScene === serializedSceneRef.current) return;
    sceneRef.current = JSON.parse(serializedScene) as ExcalidrawFile;
    serializedSceneRef.current = serializedScene;
    if (!editorReadyRef.current) {
      // Excalidraw 会先交付 API，再把 initialData 应用到画布。以首次 onChange
      // 中的完整场景建立基线，避免把冷启动时短暂的空画布当成已保存内容。
      editorReadyRef.current = true;
      if (draftRef.current) {
        revisionRef.current += 1;
        saveCoordinator.markChanged();
      } else {
        saveCoordinator.markBaseline();
      }
      return;
    }
    dirtyRef.current = true;
    revisionRef.current += 1;
    saveCoordinator.markChanged();
    setSaveStatus("dirty");
  };

  const toggleFavorite = async (): Promise<void> => {
    if (!document) return;
    const updatedDocument = await window.desktopApi.documents.toggleFavorite(
      document.id
    );
    setDocument(updatedDocument);
    await refreshWorkspace();
  };

  const commitRename = async (): Promise<void> => {
    if (!document) return;
    const nextName = nameDraft.trim();
    if (!nextName || nextName === document.name) {
      setNameDraft(document.name);
      setIsRenaming(false);
      return;
    }
    try {
      const updatedDocument = await window.desktopApi.documents.rename(
        document.id,
        nextName
      );
      setDocument(updatedDocument);
      setNameDraft(updatedDocument.name);
      await refreshWorkspace();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setIsRenaming(false);
    }
  };

  const exportAsset = async (format: "png" | "svg" | "excalidraw") => {
    if (!document || !sceneRuntimeRef.current) return;
    await performSave(true);
    if (format === "excalidraw") {
      await window.desktopApi.documents.exportFile(document.id);
    } else if (format === "png") {
      const blob = await adapter.exportPng(sceneRuntimeRef.current);
      await window.desktopApi.documents.exportAsset(
        document.id,
        "png",
        await blob.arrayBuffer()
      );
    } else {
      await window.desktopApi.documents.exportAsset(
        document.id,
        "svg",
        await adapter.exportSvg(sceneRuntimeRef.current)
      );
    }
    setExportMenuOpen(false);
  };

  if (!documentContent || !document) {
    return (
      <div className="editor-loading">
        {saveError ? (
          <>
            <FileWarning size={30} />
            <h2>无法打开画布</h2>
            <p>{saveError}</p>
            <button className="button" type="button" onClick={() => navigate("/")}>
              返回工作区
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="is-spinning" size={28} />
            <span>正在打开画布…</span>
          </>
        )}
      </div>
    );
  }

  const saveStatusContent = {
    saved: { icon: Check, text: "已保存" },
    saving: { icon: LoaderCircle, text: "正在保存" },
    dirty: { icon: Save, text: "未保存" },
    error: { icon: FileWarning, text: "保存失败" },
    conflict: { icon: FileWarning, text: "检测到外部修改" }
  }[saveStatus];
  const StatusIcon = saveStatusContent.icon;

  return (
    <div className={`editor-page ${embedded ? "editor-page--embedded" : ""}`}>
      <header className="editor-topbar">
        <div className="editor-topbar__drag-region" />
        <button
          className="editor-back"
          type="button"
          onClick={() => (embedded && onClose ? void closeEmbeddedDocument() : void returnToWorkspace())}
        >
          <ArrowLeft size={18} />
          <span>工作区</span>
        </button>
        <div className="editor-document-meta">
          {isRenaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitRename();
                if (event.key === "Escape") {
                  setNameDraft(document.name);
                  setIsRenaming(false);
                }
              }}
            />
          ) : (
            <button type="button" onDoubleClick={() => setIsRenaming(true)}>
              {document.name}
            </button>
          )}
          <span title={document.relativePath}>{document.relativePath}</span>
        </div>
        <div
          className={`save-status save-status--${saveStatus}`}
          title={saveError ?? undefined}
        >
          <StatusIcon
            size={15}
            className={saveStatus === "saving" ? "is-spinning" : ""}
          />
          <span>{saveStatusContent.text}</span>
          {saveStatus === "error" && (
            <button type="button" onClick={() => void performSave(true)}>
              <RefreshCw size={14} />
              重试
            </button>
          )}
        </div>
        <div className="editor-topbar__spacer" />
        <button
          className={`editor-icon-button ${document.isFavorite ? "is-active" : ""}`}
          type="button"
          aria-label={document.isFavorite ? "取消收藏" : "收藏"}
          onClick={() => void toggleFavorite()}
        >
          <Star size={18} fill={document.isFavorite ? "currentColor" : "none"} />
        </button>
        <div className="editor-menu-wrapper">
          <button
            className="button button--primary button--compact"
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
          >
            <Download size={16} />
            导出
            <ChevronDown size={14} />
          </button>
          {exportMenuOpen && (
            <div className="editor-dropdown">
              <button type="button" onClick={() => void exportAsset("excalidraw")}>
                <FileJson size={16} />
                Excalidraw 文件
              </button>
              <button type="button" onClick={() => void exportAsset("png")}>
                <Image size={16} />
                PNG 图片
              </button>
              <button type="button" onClick={() => void exportAsset("svg")}>
                <Image size={16} />
                SVG 图片
              </button>
            </div>
          )}
        </div>
        <div className="editor-menu-wrapper">
          <button
            className="editor-icon-button"
            type="button"
            aria-label="更多"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
          >
            <MoreHorizontal size={19} />
          </button>
          {moreMenuOpen && (
            <div className="editor-dropdown editor-dropdown--right">
              <button type="button" onClick={() => setIsRenaming(true)}>
                重命名
              </button>
              <button
                type="button"
                onClick={() => window.desktopApi.documents.reveal(document.id)}
              >
                在文件管理器中显示
              </button>
            </div>
          )}
        </div>
        <WindowControls />
      </header>
      {saveError && saveStatus !== "saved" && (
        <div className="editor-error-banner">
          <FileWarning size={16} />
          <span>{saveError}</span>
        </div>
      )}
      <div className="editor-canvas">
        <Excalidraw
          key={document.id}
          initialData={adapter.toInitialData(documentContent.sceneData)}
          excalidrawAPI={(api) => {
            sceneRuntimeRef.current = adapter.getScene(api);
          }}
          onChange={handleSceneChange}
          langCode="zh-CN"
          name={document.name}
          theme={theme}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false
            }
          }}
        />
      </div>
      {pendingLeave && document && (
        <UnsavedDocumentDialog
          documentName={document.name}
          error={leaveError}
          busy={leaveBusy}
          onSave={saveAndLeave}
          onDiscard={discardAndLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  );
}
