import { FileImage, Paperclip, ScanLine, Send, X } from "lucide-react";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { PendingImage } from "../model/composerReducer";

export type { PendingImage } from "../model/composerReducer";

export interface AiComposerHandle {
  focus: () => void;
  openFilePicker: () => void;
}

interface AiComposerProps {
  draft: string;
  busy: boolean;
  hasDetail: boolean;
  selectionAvailable: boolean;
  visionModelConfigured: boolean;
  pendingSelection: boolean;
  pendingSelectionImage: boolean;
  selectedBaseTurnId?: string;
  pendingImages: PendingImage[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onVisionUnavailable: () => void;
  onToggleSelection: () => void;
  onToggleSelectionImage: () => void;
  onClearBase: () => void;
  onClearSelection: () => void;
  onRemoveImage: (image: PendingImage) => void;
}

export const AiComposer = forwardRef<AiComposerHandle, AiComposerProps>(function AiComposer(
  {
    draft,
    busy,
    hasDetail,
    selectionAvailable,
    visionModelConfigured,
    pendingSelection,
    pendingSelectionImage,
    selectedBaseTurnId,
    pendingImages,
    onDraftChange,
    onSend,
    onAddFiles,
    onVisionUnavailable,
    onToggleSelection,
    onToggleSelectionImage,
    onClearBase,
    onClearSelection,
    onRemoveImage
  },
  ref
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    openFilePicker: () => fileInputRef.current?.click()
  }));

  useEffect(() => {
    if (!previewUrl) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setPreviewUrl(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [previewUrl]);

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const file = Array.from(event.clipboardData.files)[0];
    if (file) {
      event.preventDefault();
      onAddFiles([file]);
    }
  };

  const canSend = !busy && Boolean(draft.trim()) && hasDetail;
  const hasContextChips = Boolean(selectedBaseTurnId || pendingSelection || pendingSelectionImage);

  return (
    <div
      className="ai-composer"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onAddFiles(event.dataTransfer.files);
      }}
    >
      <div className="ai-composer__shell">
        {pendingImages.length > 0 && (
          <div className="ai-composer__thumbs">
            {pendingImages.map((image) => (
              <div className="ai-attachment-thumb" key={image.previewUrl}>
                <button
                  type="button"
                  className="ai-attachment-thumb__preview"
                  aria-label={`预览 ${image.fileName}`}
                  onClick={() => setPreviewUrl(image.previewUrl)}
                >
                  <img src={image.previewUrl} alt={image.fileName} />
                </button>
                <button
                  type="button"
                  className="ai-attachment-thumb__remove"
                  aria-label={`删除 ${image.fileName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveImage(image);
                  }}
                >
                  <X size={12} />
                </button>
                <span className="ai-attachment-thumb__name" title={image.fileName}>{image.fileName}</span>
              </div>
            ))}
          </div>
        )}
        {hasContextChips && (
          <div className="ai-composer__chips">
            {selectedBaseTurnId && (
              <button type="button" className="ai-context-chip" onClick={onClearBase}>
                基于历史结果修改 <X size={12} />
              </button>
            )}
            {pendingSelection && (
              <button type="button" className="ai-context-chip" onClick={onClearSelection}>
                参考当前选区 <X size={12} />
              </button>
            )}
            {pendingSelectionImage && (
              <button type="button" className="ai-context-chip" onClick={onToggleSelectionImage}>
                选区外观 <X size={12} />
              </button>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="描述你想要的图表…"
          disabled={busy || !hasDetail}
        />
        <div className="ai-composer__footer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              if (event.target.files) onAddFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="ai-composer__tools">
            <button
              className="ai-composer__tool"
              type="button"
              aria-label="上传截图生成图表"
              aria-disabled={!visionModelConfigured}
              title={visionModelConfigured ? "上传截图生成图表" : "需要先配置视觉模型"}
              onClick={() => {
                if (!visionModelConfigured) {
                  onVisionUnavailable();
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={busy}
            >
              <Paperclip size={16} />
            </button>
            <button
              className={`ai-composer__tool ${pendingSelection ? "is-active" : ""}`}
              type="button"
              aria-label="选中画布元素作为上下文"
              title="选中画布元素作为上下文"
              disabled={!selectionAvailable || busy}
              onClick={onToggleSelection}
            >
              <ScanLine size={16} />
            </button>
            {pendingSelection && (
              <button
                className={`ai-composer__tool ${pendingSelectionImage ? "is-active" : ""}`}
                type="button"
                aria-label="同时参考选区外观"
                title={!visionModelConfigured
                  ? "需要先配置视觉模型"
                  : pendingImages.length > 0
                    ? "当前一次生成仅支持一张图片"
                    : "同时参考选区外观"}
                disabled={busy || !visionModelConfigured || pendingImages.length > 0}
                onClick={onToggleSelectionImage}
              >
                <FileImage size={16} />
              </button>
            )}
          </div>
          <button
            className="ai-composer__send"
            type="button"
            aria-label="发送"
            title="发送 (Ctrl/Cmd + Enter)"
            disabled={!canSend}
            onClick={onSend}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
      {previewUrl && (
        <div
          className="ai-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="附件预览"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="ai-image-lightbox__close"
            aria-label="关闭预览"
            onClick={() => setPreviewUrl(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
});
