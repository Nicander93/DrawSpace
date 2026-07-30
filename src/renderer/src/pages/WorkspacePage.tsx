import {
  AlertCircle,
  ChevronDown,
  FilePlus2,
  Folder,
  FolderPlus,
  RefreshCw,
  Trash2,
  Upload
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CanvasDocument, DocumentSort } from "@shared/types";
import { DocumentCard } from "../components/DocumentCard";
import { DocumentContextMenu } from "../components/DocumentContextMenu";
import { DocumentList } from "../components/DocumentList";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { MoveDocumentDialog } from "../components/MoveDocumentDialog";
import { MoveDocumentsDialog } from "../components/MoveDocumentsDialog";
import { QuickActions } from "../components/QuickActions";
import { StoragePanel } from "../components/StoragePanel";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { WorkspaceTopbar } from "../components/WorkspaceTopbar";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useEditorStore } from "../stores/editorStore";
import { useAppCloseHandler } from "../features/lifecycle/AppCloseContext";

type DialogState =
  | { type: "rename"; document: CanvasDocument }
  | { type: "move"; document: CanvasDocument }
  | { type: "delete"; document: CanvasDocument }
  | { type: "createFolder" }
  | null;

interface ContextMenuState {
  documentId: string;
  x: number;
  y: number;
}

const pageTitles = {
  home: "首页",
  all: "全部画布",
  recent: "最近打开",
  favorites: "收藏夹",
  trash: "回收站"
} as const;

export function WorkspacePage({ visible = true }: { visible?: boolean }) {
  const navigate = useNavigate();
  const {
    workspace,
    documents,
    directories,
    total,
    loading,
    scanning,
    error,
    filter,
    sort,
    search,
    view,
    pageNum,
    pageSize,
    selectedDocumentId,
    selectedDocumentIds,
    refresh,
    rescan,
    setFilter,
    setSort,
    setSearch,
    setView,
    setPageNum,
    setSelectedDocumentId,
    selectDocument,
    selectAllDocuments
  } = useWorkspaceStore();
  const updateEditorMetadata = useEditorStore((state) => state.updateDocumentMetadata);
  const openEditorDocument = useEditorStore((state) => state.openDocument);
  const [searchDraft, setSearchDraft] = useState(search);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFailure, setOpenFailure] = useState<{
    document: CanvasDocument;
    message: string;
  } | null>(null);
  const [restoreConflictDocument, setRestoreConflictDocument] =
    useState<CanvasDocument | null>(null);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft);
      void refresh();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [refresh, searchDraft, setSearch]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const openTabs = useEditorStore.getState().tabs;
    const documentsById = new Map(documents.map((document) => [document.id, document]));
    openTabs.forEach((tab) => {
      const document = documentsById.get(tab.documentId);
      if (document) {
        updateEditorMetadata({
          documentId: document.id,
          name: document.name,
          relativePath: document.relativePath,
          isFavorite: document.isFavorite
        });
      }
    });
  }, [documents, updateEditorMetadata]);

  useAppCloseHandler(
    (request) => window.desktopApi.lifecycle.respondToClose({ requestId: request.requestId, decision: "proceed" }),
    visible
  );

  useEffect(
    () =>
      window.desktopApi.workspace.onIndexChanged(() => {
        void refresh();
      }),
    [refresh]
  );

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const openDocument = useCallback(
    (documentId: string) => {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        setToast("未找到要打开的画布");
        return;
      }
      openEditorDocument({
        documentId: document.id,
        name: document.name,
        relativePath: document.relativePath,
        isFavorite: document.isFavorite
      });
      // Navigate immediately. EditorWorkspacePage/EditorPage owns the async
      // open handshake and can show its loading or error state without
      // leaving the workspace click waiting on IPC.
      navigate(`/editor/${documentId}`);
    },
    [documents, navigate, openEditorDocument]
  );

  const createDocument = useCallback(
    async (relativeDirectory?: string) => {
      try {
        const initialContent = await window.desktopApi.documents.create(
          relativeDirectory
        );
        navigate(`/editor/${initialContent.document.id}`, {
          state: { initialContent, isDraft: true }
        });
      } catch (createError) {
        setToast(
          createError instanceof Error ? createError.message : "新建画布失败"
        );
      }
    },
    [navigate]
  );

  const importDocuments = useCallback(async () => {
    try {
      const importedDocuments = await window.desktopApi.documents.importFromDialog();
      if (importedDocuments.length > 0) {
        setToast(`已导入 ${importedDocuments.length} 个画布`);
        await refresh();
      }
    } catch (importError) {
      setToast(importError instanceof Error ? importError.message : "导入失败");
    }
  }, [refresh]);

  const moveToTrash = useCallback(
    async (document: CanvasDocument) => {
      await window.desktopApi.documents.trash(document.id);
      setSelectedDocumentId(null);
      setToast(`“${document.name}”已移入回收站`);
      await refresh();
    },
    [refresh, setSelectedDocumentId]
  );

  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyboard = (event: KeyboardEvent): void => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (isModifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createDocument();
      } else if (isModifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void importDocuments();
      } else if (isModifier && event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".workspace-search input")?.focus();
      } else if (isModifier && event.key.toLowerCase() === "a") {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
        selectAllDocuments();
      } else if (event.key === "Delete" && activeDocument && !activeDocument.isDeleted) {
        event.preventDefault();
        void moveToTrash(activeDocument);
      } else if (event.key === "F2" && activeDocument && !activeDocument.isDeleted) {
        event.preventDefault();
        setDialogValue(activeDocument.name);
        setDialog({ type: "rename", document: activeDocument });
      } else if (event.key === "Escape") {
        setSelectedDocumentId(null);
        setContextMenu(null);
        setDialog(null);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    activeDocument,
    createDocument,
    importDocuments,
    moveToTrash,
    selectAllDocuments,
    setSelectedDocumentId,
    visible
  ]);

    const moveDocumentToFolder = useCallback(async (documentId: string, directory: string) => {
    try {
      const updated = await window.desktopApi.documents.move(documentId, directory);
      updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite });
      setToast("画布已移动");
      await refresh();
    } catch (moveError) {
      setToast(moveError instanceof Error ? moveError.message : "移动失败");
    }
  }, [refresh, updateEditorMetadata]);

  if (!workspace) {
    return null;
  }

  const showContextMenu = (
    event: React.MouseEvent,
    documentId: string
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedDocumentIds.includes(documentId)) setSelectedDocumentId(documentId);
    setContextMenu({ documentId, x: event.clientX, y: event.clientY });
  };

  const contextDocument = contextMenu
    ? documents.find((document) => document.id === contextMenu.documentId)
    : null;

  const handleContextAction = async (
    action:
      | "open"
      | "rename"
      | "copy"
      | "move"
      | "favorite"
      | "reveal"
      | "export"
      | "trash"
      | "restore"
      | "delete"
      | "batchOpen"
      | "batchFavorite"
      | "batchMove"
      | "batchTrash"
  ): Promise<void> => {
    if (!contextDocument) return;
    setContextMenu(null);
    if (action === "batchOpen") {
      openSelectedDocuments();
      return;
    }
    if (action === "batchFavorite") {
      await toggleSelectedFavorites();
      return;
    }
    if (action === "batchMove") {
      setBatchMoveOpen(true);
      return;
    }
    if (action === "batchTrash") {
      await trashSelectedDocuments();
      return;
    }
    if (action === "open") {
      await openDocument(contextDocument.id);
      return;
    }
    if (action === "rename" || action === "move" || action === "delete") {
      setDialogValue(action === "rename" ? contextDocument.name : "");
      setDialog({ type: action, document: contextDocument });
      return;
    }
    try {
      if (action === "copy") {
        await window.desktopApi.documents.copy(contextDocument.id);
        setToast("副本已创建");
      } else if (action === "favorite") {
        const updated = await window.desktopApi.documents.toggleFavorite(contextDocument.id);
        updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite });
      } else if (action === "reveal") {
        await window.desktopApi.documents.reveal(contextDocument.id);
      } else if (action === "export") {
        await window.desktopApi.documents.exportFile(contextDocument.id);
      } else if (action === "trash") {
        await moveToTrash(contextDocument);
        return;
      } else if (action === "restore") {
        if (
          await window.desktopApi.documents.hasRestoreConflict(
            contextDocument.id
          )
        ) {
          setRestoreConflictDocument(contextDocument);
          return;
        }
        await window.desktopApi.documents.restore(contextDocument.id);
        setToast("画布已恢复");
      }
      await refresh();
    } catch (actionError) {
      setToast(actionError instanceof Error ? actionError.message : "操作失败");
    }
  };

  const submitDialog = async (): Promise<void> => {
    if (!dialog || submitting) return;
    setSubmitting(true);
    try {
      if (dialog.type === "rename") {
        const updated = await window.desktopApi.documents.rename(dialog.document.id, dialogValue);
        updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite });
        setToast("画布已重命名");
      } else if (dialog.type === "move") {
        const updated = await window.desktopApi.documents.move(dialog.document.id, dialogValue);
        updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite });
        setToast("画布已移动");
      } else if (dialog.type === "delete") {
        await window.desktopApi.documents.deletePermanently(dialog.document.id);
        setToast("画布已永久删除");
      } else if (dialog.type === "createFolder") {
        const directory = currentFolder ? `${currentFolder}/${dialogValue.trim()}` : dialogValue.trim();
        await window.desktopApi.workspace.createDirectory(directory);
        setToast("文件夹已创建");
      }
      setDialog(null);
      await refresh();
    } catch (dialogError) {
      setToast(dialogError instanceof Error ? dialogError.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.name.toLowerCase().endsWith(".excalidraw")
    );
    if (files.length === 0) {
      setToast("请选择 .excalidraw 文件");
      return;
    }
    try {
      for (const file of files) {
        await window.desktopApi.documents.importBuffer(
          file.name,
          await file.arrayBuffer()
        );
      }
      setToast(`已导入 ${files.length} 个画布`);
      await refresh();
    } catch (dropError) {
      setToast(dropError instanceof Error ? dropError.message : "导入失败");
    }
  };

  const documentDirectory = (relativePath: string): string => {
    const separator = relativePath.lastIndexOf("/");
    return separator < 0 ? "" : relativePath.slice(0, separator);
  };
  const folderEntries = filter === "all" && !searchDraft
    ? directories.filter((directory) => documentDirectory(directory) === (currentFolder ?? ""))
    : [];
  const displayedDocuments = filter === "home" && !searchDraft
    ? documents.slice(0, 5)
    : currentFolder && filter === "all" && !searchDraft
      ? documents.filter((document) => documentDirectory(document.relativePath) === currentFolder)
      : documents;
  const isHome = filter === "home" && !searchDraft;
  const isFolderView = filter === "all" && !searchDraft;
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  const toggleSelectedFavorites = async (): Promise<void> => {
    await Promise.all(selectedDocuments.filter((document) => !document.isDeleted).map((document) => window.desktopApi.documents.toggleFavorite(document.id)));
    setToast(`已更新 ${selectedDocuments.length} 个画布的收藏状态`);
    await refresh();
  };

  const trashSelectedDocuments = async (): Promise<void> => {
    await Promise.all(selectedDocuments.filter((document) => !document.isDeleted).map((document) => window.desktopApi.documents.trash(document.id)));
    setSelectedDocumentId(null);
    setToast(`已移入 ${selectedDocuments.length} 个画布到回收站`);
    await refresh();
  };

  const openSelectedDocuments = (): void => {
    for (const document of selectedDocuments) {
      openEditorDocument({ documentId: document.id, name: document.name, relativePath: document.relativePath, isFavorite: document.isFavorite });
    }
    const lastDocument = selectedDocuments.at(-1);
    if (lastDocument) navigate(`/editor/${lastDocument.id}`);
  };

  const renderFolderCard = (directory: string) => (
    <article
      className={`document-card folder-card ${selectedFolder === directory ? "is-selected" : ""}`}
      key={directory}
      role="button"
      tabIndex={0}
      onClick={() => {
        setSelectedFolder(directory);
        setSelectedDocumentId(null);
      }}
      onDoubleClick={() => {
        setCurrentFolder(directory);
        setSelectedFolder(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setCurrentFolder(directory);
          setSelectedFolder(null);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const documentId = event.dataTransfer.getData("application/x-canvas-document");
        if (documentId) void moveDocumentToFolder(documentId, directory);
      }}
    >
      <div className="document-card__preview folder-card__preview">
        <input
          className="document-card__checkbox"
          type="checkbox"
          checked={selectedFolder === directory}
          aria-label={`选择文件夹 ${directory}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => setSelectedFolder((selected) => selected === directory ? null : directory)}
        />
        <Folder size={52} fill="currentColor" strokeWidth={1.4} />
      </div>
      <div className="document-card__body">
        <div><h3>{directory.split("/").at(-1)}</h3></div>
        <p title={directory}>{directory}</p>
        <small>文件夹</small>
      </div>
    </article>
  );
  return (
    <div
      className="workspace-page"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDraggingFile(false);
      }}
      onDrop={(event) => void handleDrop(event)}
      onClick={() => setContextMenu(null)}
    >
      <WorkspaceSidebar
        activeFilter={filter}
        onFilterChange={(nextFilter) => {
          setCurrentFolder(null);
          setSearchDraft("");
          setSearch("");
          setFilter(nextFilter);
        }}
      />
      <div className="workspace-shell">
        <WorkspaceTopbar
          search={searchDraft}
          view={view}
          onSearchChange={setSearchDraft}
          onViewChange={setView}
        />
        <main className={`workspace-main ${isHome ? "workspace-main--home" : ""}`}>
          <div className="workspace-content">
            {isHome ? (
              <>
                <QuickActions
                  onCreate={() => void createDocument(currentFolder ?? undefined)}
                  onImport={() => void importDocuments()}
                />
              </>
            ) : (
              <div className="page-heading">
                <div>
                  {currentFolder && (
                    <div className="folder-breadcrumb">
                      <button type="button" onClick={() => setCurrentFolder(null)}>全部画布</button>
                      <span>/</span>
                      <span>{currentFolder}</span>
                    </div>
                  )}
                  <h1>{searchDraft ? `搜索“${searchDraft}”` : currentFolder ? currentFolder.split("/").at(-1) : pageTitles[filter]}</h1>
                  <p>{loading ? "正在读取本地索引…" : `共 ${isFolderView ? displayedDocuments.length : total} 个画布`}</p>
                </div>
                <div className="page-heading__actions">
                  {filter === "trash" ? (
                    total > 0 && (
                      <button
                        className="button button--danger-outline"
                        type="button"
                        onClick={() => {
                          void window.desktopApi.documents.emptyTrash().then(refresh);
                        }}
                      >
                        <Trash2 size={16} />
                        清空回收站
                      </button>
                    )
                  ) : (
                    <>
                      <button className="button" type="button" onClick={() => void importDocuments()}>
                        <Upload size={16} />
                        导入
                      </button>
                      {isFolderView && (
                        <button className="button" type="button" onClick={() => { setDialogValue(""); setDialog({ type: "createFolder" }); }}>
                          <FolderPlus size={16} />
                          新建文件夹
                        </button>
                      )}
                      <button className="button button--primary" type="button" onClick={() => void createDocument(currentFolder ?? undefined)}>
                        <FilePlus2 size={16} />
                        新建画布
                      </button>
                    </>
                  )}
                  <label className="sort-select">
                    <span>排序</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as DocumentSort)}
                    >
                      <option value="lastOpened">最近打开</option>
                      <option value="modified">最近修改</option>
                      <option value="nameAsc">名称升序</option>
                      <option value="nameDesc">名称降序</option>
                      <option value="created">创建时间</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {isHome && (
              <div className="collection-heading">
                <div>
                  <h2>最近画布</h2>
                  <span>{total > 5 ? `显示最近 5 个，共 ${total} 个` : `${total} 个`}</span>
                </div>
                <button type="button" onClick={() => setFilter("all")}>
                  查看全部
                  <ChevronDown size={15} />
                </button>
              </div>
            )}

            {error && (
              <div className="inline-error">
                <AlertCircle size={17} />
                <span>{error}</span>
                <button type="button" onClick={() => void refresh()}>
                  <RefreshCw size={15} />
                  重试
                </button>
              </div>
            )}

            {loading ? (
              <div className="document-skeletons">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            ) : displayedDocuments.length === 0 && folderEntries.length === 0 ? (
              <EmptyState
                isTrash={filter === "trash"}
                onCreate={() => void createDocument(currentFolder ?? undefined)}
                onImport={() => void importDocuments()}
              />
            ) : (
              <>
                {view !== "grid" && isFolderView && folderEntries.length > 0 && (
                  <div className="folder-grid" aria-label="文件夹">
                    {folderEntries.map(renderFolderCard)}
                  </div>
                )}
                {view === "grid" ? (
              <div className="document-grid">
                {isFolderView && folderEntries.map(renderFolderCard)}
                {displayedDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    selected={selectedDocumentIds.includes(document.id)}
                    onSelect={(event) => { setSelectedFolder(null); selectDocument(document.id, event.shiftKey ? "range" : event.ctrlKey || event.metaKey ? "toggle" : "replace"); }}
                    onToggleSelection={() => selectDocument(document.id, "toggle")}
                    onOpen={() => void openDocument(document.id)}
                    onToggleFavorite={() => void (async () => { const updated = await window.desktopApi.documents.toggleFavorite(document.id); updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite }); await refresh(); })()}
                    onContextMenu={(event) => showContextMenu(event, document.id)}
                    onDragStart={(event, documentId) => event.dataTransfer.setData("application/x-canvas-document", documentId)}
                  />
                ))}
              </div>
                ) : (
                  <DocumentList
                    documents={displayedDocuments}
                    selectedDocumentId={selectedDocumentId}
                    selectedDocumentIds={selectedDocumentIds}
                    onSelect={(documentId, event) => { setSelectedFolder(null); selectDocument(documentId, event.shiftKey ? "range" : event.ctrlKey || event.metaKey ? "toggle" : "replace"); }}
                    onOpen={(documentId) => void openDocument(documentId)}
                    onToggleFavorite={(documentId) => void (async () => { const updated = await window.desktopApi.documents.toggleFavorite(documentId); updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite }); await refresh(); })()}
                    onContextMenu={showContextMenu}
                  />
                )}
              </>
            )}
            {!isHome && total > pageSize && (
              <div className="pagination">
                <button
                  className="button"
                  type="button"
                  disabled={pageNum === 1}
                  onClick={() => setPageNum(pageNum - 1)}
                >
                  上一页
                </button>
                <span>
                  第 {pageNum} / {Math.ceil(total / pageSize)} 页
                </span>
                <button
                  className="button"
                  type="button"
                  disabled={pageNum >= Math.ceil(total / pageSize)}
                  onClick={() => setPageNum(pageNum + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </div>

          {isHome && (
            <StoragePanel
              workspace={workspace}
              scanning={scanning}
              onRescan={() => void rescan()}
            />
          )}


        </main>
      </div>

      {contextMenu && contextDocument && (
        <DocumentContextMenu
          document={contextDocument}
          position={contextMenu}
          selectedCount={selectedDocumentIds.length}
          onAction={(action) => void handleContextAction(action)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {dialog?.type === "move" && (
        <MoveDocumentDialog document={dialog.document} directories={directories} onClose={() => setDialog(null)} onMoved={async (updated) => { if (updated) updateEditorMetadata({ documentId: updated.id, name: updated.name, relativePath: updated.relativePath, isFavorite: updated.isFavorite }); await refresh(); }} />
      )}
      {batchMoveOpen && (
        <MoveDocumentsDialog
          documents={selectedDocuments}
          directories={directories}
          onClose={() => setBatchMoveOpen(false)}
          onMoved={async () => { setSelectedDocumentId(null); await refresh(); }}
        />
      )}
      {dialog && dialog.type !== "move" && (
        <Modal
          title={
            dialog.type === "rename"
              ? "重命名画布"
              : dialog.type === "delete"
                  ? "永久删除"
                  : "新建文件夹"
          }
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="button" type="button" onClick={() => setDialog(null)}>
                取消
              </button>
              <button
                className={`button ${
                  dialog.type === "delete" ? "button--danger" : "button--primary"
                }`}
                type="button"
                disabled={submitting || (dialog.type !== "delete" && !dialogValue.trim())}
                onClick={() => void submitDialog()}
              >
                {submitting
                  ? "处理中…"
                  : dialog.type === "delete"
                    ? "永久删除"
                    : "确定"}
              </button>
            </>
          }
        >
          {dialog.type === "delete" ? (
            <p>
              “{dialog.document.name}”将被永久删除，此操作无法撤销。
            </p>
          ) : (
            <label className="field">
              <span>
                {dialog.type === "rename" ? "画布名称" : "工作区内文件夹路径"}
              </span>
              <input
                autoFocus
                value={dialogValue}
                placeholder={dialog.type === "rename" ? "输入新名称" : "例如：产品设计/原型"}
                onChange={(event) => setDialogValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitDialog();
                }}
              />
              {dialog.type !== "rename" && (
                <small>文件夹不存在时会自动创建</small>
              )}
            </label>
          )}
        </Modal>
      )}

      {openFailure && (
        <Modal
          title="无法打开画布"
          onClose={() => setOpenFailure(null)}
          footer={
            <>
              <button
                className="button"
                type="button"
                onClick={() =>
                  void window.desktopApi.documents.reveal(openFailure.document.id)
                }
              >
                在文件管理器中显示
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  void (async () => {
                    const snapshots = await window.desktopApi.recovery.list();
                    const snapshot = snapshots.find(
                      (item) => item.documentId === openFailure.document.id
                    );
                    if (!snapshot) {
                      setToast("没有找到可用的恢复快照");
                      return;
                    }
                    const initialContent = await window.desktopApi.recovery.restore(
                      snapshot.documentId
                    );
                    setOpenFailure(null);
                    navigate(`/editor/${initialContent.document.id}`, {
                      state: { initialContent }
                    });
                  })();
                }}
              >
                尝试恢复快照
              </button>
            </>
          }
        >
          <p>{openFailure.message}</p>
        </Modal>
      )}

      {restoreConflictDocument && (
        <Modal
          title="恢复位置已有同名画布"
          onClose={() => setRestoreConflictDocument(null)}
          footer={
            <>
              <button
                className="button"
                type="button"
                onClick={() => setRestoreConflictDocument(null)}
              >
                取消
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  void (async () => {
                    await window.desktopApi.documents.restore(
                      restoreConflictDocument.id,
                      "rename"
                    );
                    setRestoreConflictDocument(null);
                    setToast("画布已重命名并恢复");
                    await refresh();
                  })();
                }}
              >
                重命名后恢复
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => {
                  void (async () => {
                    await window.desktopApi.documents.restore(
                      restoreConflictDocument.id,
                      "overwrite"
                    );
                    setRestoreConflictDocument(null);
                    setToast("原位置文件已被覆盖");
                    await refresh();
                  })();
                }}
              >
                覆盖并恢复
              </button>
            </>
          }
        >
          <p>
            “{restoreConflictDocument.name}”的原位置已经存在同名文件。你可以保留两份，
            或用回收站中的版本覆盖现有文件。
          </p>
        </Modal>
      )}

      {isDraggingFile && (
        <div className="drop-overlay">
          <Upload size={36} />
          <strong>松开即可导入画布</strong>
          <span>支持一个或多个 .excalidraw 文件</span>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
