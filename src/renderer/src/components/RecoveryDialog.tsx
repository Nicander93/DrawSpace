import { Eye, FileClock, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RecoveryItem } from "@shared/types";

interface RecoveryDialogProps {
  items: RecoveryItem[];
  onItemsChange(items: RecoveryItem[]): void;
}

export function RecoveryDialog({
  items,
  onItemsChange
}: RecoveryDialogProps) {
  const navigate = useNavigate();
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);
  const [restoringDocumentId, setRestoringDocumentId] = useState<string | null>(
    null
  );
  const currentItem = items[0];

  if (!currentItem) {
    return null;
  }

  const removeCurrentItem = (): void => {
    onItemsChange(items.filter((item) => item.documentId !== currentItem.documentId));
  };

  const restore = async (): Promise<void> => {
    setRestoringDocumentId(currentItem.documentId);
    try {
      const documentContent = await window.desktopApi.recovery.restore(
        currentItem.documentId
      );
      removeCurrentItem();
      navigate(`/editor/${documentContent.document.id}`, {
        state: { initialContent: documentContent }
      });
    } finally {
      setRestoringDocumentId(null);
    }
  };

  const discard = async (): Promise<void> => {
    await window.desktopApi.recovery.discard(currentItem.documentId);
    removeCurrentItem();
  };

  return (
    <div className="recovery-backdrop">
      <section className="recovery-dialog" role="dialog" aria-modal="true">
        <button
          className="recovery-dialog__close"
          type="button"
          aria-label="暂时忽略"
          onClick={removeCurrentItem}
        >
          <X size={18} />
        </button>
        <div className="recovery-dialog__icon">
          <FileClock size={30} />
        </div>
        <h2>找到了未保存的画布</h2>
        <p>
          “{currentItem.documentName}” 有一份比正式文件更新的恢复快照。恢复时会创建副本，
          不会覆盖原文件。
        </p>
        {expandedDocumentId === currentItem.documentId && (
          <div className="recovery-details">
            <span>
              快照时间：
              {new Intl.DateTimeFormat("zh-CN", {
                dateStyle: "medium",
                timeStyle: "short"
              }).format(currentItem.savedAt)}
            </span>
            <span>画布元素：{currentItem.sceneData.elements.length} 个</span>
            <span title={currentItem.sourcePath}>来源：{currentItem.sourcePath}</span>
          </div>
        )}
        <div className="recovery-dialog__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={restoringDocumentId === currentItem.documentId}
            onClick={() => void restore()}
          >
            <RotateCcw size={16} />
            {restoringDocumentId ? "正在恢复…" : "恢复为副本"}
          </button>
          <button
            className="button"
            type="button"
            onClick={() =>
              setExpandedDocumentId(
                expandedDocumentId === currentItem.documentId
                  ? null
                  : currentItem.documentId
              )
            }
          >
            <Eye size={16} />
            查看
          </button>
          <button className="button button--ghost-danger" type="button" onClick={() => void discard()}>
            <Trash2 size={16} />
            删除快照
          </button>
        </div>
        {items.length > 1 && <small>还有 {items.length - 1} 份恢复快照</small>}
      </section>
    </div>
  );
}
