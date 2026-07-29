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
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useWorkspaceStore } from "../stores/workspaceStore";

type SaveStatus = "saved" | "saving" | "dirty" | "error" | "conflict";

interface EditorLocationState {
  initialContent?: DocumentContent;
}

const adapter = new ExcalidrawAdapter();

export function EditorPage() {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const refreshWorkspace = useWorkspaceStore((state) => state.refresh);
  const locationState = location.state as EditorLocationState | null;
  const initialContent =
    locationState?.initialContent &&
    locationState.initialContent.document.id === documentId
      ? locationState.initialContent
      : null;
  const [documentContent, setDocumentContent] =
    useState<DocumentContent | null>(initialContent);
  const [document, setDocument] = useState<CanvasDocument | null>(
    documentContent?.document ?? null
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(document?.name ?? "");
  const sceneRef = useRef<ExcalidrawFile | null>(
    documentContent?.sceneData ?? null
  );
  const sceneRuntimeRef = useRef<CanvasScene | null>(null);
  const versionRef = useRef(documentContent?.version ?? "");
  const sessionIdRef = useRef(documentContent?.sessionId ?? "");
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const ignoreChangesUntilRef = useRef(Date.now() + 250);
  const saveTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

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
        sceneRuntimeRef.current = null;
        versionRef.current = content.version;
        sessionIdRef.current = content.sessionId;
        dirtyRef.current = false;
        revisionRef.current = 0;
        ignoreChangesUntilRef.current = Date.now() + 250;
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

  const performSave = useCallback(
    async (force = false): Promise<boolean> => {
      if (!document || !sceneRef.current) return false;
      if (!dirtyRef.current && !force) return true;
      if (!dirtyRef.current && force) return true;
      if (savePromiseRef.current) {
        const previousSaveSucceeded = await savePromiseRef.current;
        if (force && dirtyRef.current) {
          return performSave(true);
        }
        return previousSaveSucceeded && !dirtyRef.current;
      }
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const revisionToSave = revisionRef.current;
      const sceneDataToSave = sceneRef.current;
      const saveOperation = (async (): Promise<boolean> => {
        setSaveStatus("saving");
        setSaveError(null);
        const result = await window.desktopApi.documents.save({
          documentId: document.id,
          sceneData: sceneDataToSave,
          expectedVersion: versionRef.current
        });
        if (result.status === "conflict") {
          dirtyRef.current = revisionRef.current !== revisionToSave;
          setSaveStatus("conflict");
          setSaveError(result.message);
          await window.desktopApi.sessions.close(sessionIdRef.current);
          let conflictContent = await window.desktopApi.documents.open(
            result.conflictDocument.id
          );
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
            }
          }
          setDocumentContent(conflictContent);
          setDocument(conflictContent.document);
          setNameDraft(conflictContent.document.name);
          sceneRef.current = conflictContent.sceneData;
          sceneRuntimeRef.current = null;
          versionRef.current = conflictContent.version;
          sessionIdRef.current = conflictContent.sessionId;
          revisionRef.current = 0;
          ignoreChangesUntilRef.current = Date.now() + 250;
          navigate(`/editor/${result.conflictDocument.id}`, {
            replace: true,
            state: { initialContent: conflictContent }
          });
          return false;
        }
        versionRef.current = result.version;
        setDocument(result.document);
        dirtyRef.current = revisionRef.current !== revisionToSave;
        setSaveStatus(dirtyRef.current ? "dirty" : "saved");
        void saveThumbnail();
        return true;
      })();
      savePromiseRef.current = saveOperation;
      try {
        const saved = await saveOperation;
        if (dirtyRef.current && saved) {
          if (force) {
            savePromiseRef.current = null;
            return performSave(true);
          }
          saveTimerRef.current = window.setTimeout(() => {
            void performSave();
          }, 120);
        }
        return saved && !dirtyRef.current;
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存失败";
        setSaveStatus("error");
        setSaveError(message);
        await saveRecoverySnapshot().catch(() => undefined);
        return false;
      } finally {
        savePromiseRef.current = null;
      }
    },
    [document, navigate, saveRecoverySnapshot, saveThumbnail]
  );

  useEffect(() => {
    const saveOnBlur = (): void => {
      if (dirtyRef.current) void performSave(true);
    };
    window.addEventListener("blur", saveOnBlur);
    return () => window.removeEventListener("blur", saveOnBlur);
  }, [performSave]);

  useEffect(() => {
    const recoveryTimer = window.setInterval(() => {
      if (dirtyRef.current) {
        void saveRecoverySnapshot();
      }
    }, 10_000);
    return () => window.clearInterval(recoveryTimer);
  }, [saveRecoverySnapshot]);

  const returnToWorkspace = useCallback(async () => {
    const saved = await performSave(true);
    if (!saved && dirtyRef.current) {
      return;
    }
    if (sessionIdRef.current) {
      await window.desktopApi.sessions.close(sessionIdRef.current);
    }
    await refreshWorkspace();
    navigate("/");
  }, [navigate, performSave, refreshWorkspace]);

  useEffect(() => {
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
      if (isModifier && event.key.toLowerCase() === "w") {
        event.preventDefault();
        void returnToWorkspace();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [document, performSave, returnToWorkspace]);

  useEffect(
    () =>
      window.desktopApi.lifecycle.onCloseRequested(() => {
        void (async () => {
          const saved = await performSave(true);
          if (!saved && dirtyRef.current) {
            await saveRecoverySnapshot().catch(() => undefined);
          } else if (sessionIdRef.current) {
            await window.desktopApi.sessions
              .close(sessionIdRef.current)
              .catch(() => undefined);
          }
          window.desktopApi.lifecycle.readyToClose();
        })();
      }),
    [performSave, saveRecoverySnapshot]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (dirtyRef.current) {
        void saveRecoverySnapshot();
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
    sceneRuntimeRef.current = scene;
    sceneRef.current = adapter.fromScene(scene);
    if (Date.now() < ignoreChangesUntilRef.current) {
      return;
    }
    dirtyRef.current = true;
    revisionRef.current += 1;
    setSaveStatus("dirty");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void performSave();
    }, 800);
  };

  const toggleFavorite = async (): Promise<void> => {
    if (!document) return;
    const updatedDocument = await window.desktopApi.documents.toggleFavorite(
      document.id
    );
    setDocument(updatedDocument);
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
    <div className="editor-page">
      <header className="editor-topbar">
        <div className="editor-topbar__drag-region" />
        <button
          className="editor-back"
          type="button"
          onClick={() => void returnToWorkspace()}
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
          theme={documentContent.sceneData.appState.theme === "dark" ? "dark" : "light"}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false
            }
          }}
        />
      </div>
    </div>
  );
}
