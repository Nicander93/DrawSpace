import { FileImage, Paperclip, ScanLine, Send, X } from "lucide-react";
import { useRef } from "react";
import type { PendingImage } from "../model/composerReducer";

export type { PendingImage } from "../model/composerReducer";

interface AiComposerProps {
  draft: string;
  busy: boolean;
  hasDetail: boolean;
  selectionAvailable: boolean;
  pendingSelection: boolean;
  pendingSelectionImage: boolean;
  selectedBaseTurnId?: string;
  pendingImages: PendingImage[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onToggleSelection: () => void;
  onToggleSelectionImage: () => void;
  onClearBase: () => void;
  onClearSelection: () => void;
  onRemoveImage: (image: PendingImage) => void;
}

export function AiComposer({ draft, busy, hasDetail, selectionAvailable, pendingSelection, pendingSelectionImage, selectedBaseTurnId, pendingImages, onDraftChange, onSend, onAddFiles, onToggleSelection, onToggleSelectionImage, onClearBase, onClearSelection, onRemoveImage }: AiComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const file = Array.from(event.clipboardData.files)[0];
    if (file) {
      event.preventDefault();
      onAddFiles([file]);
    }
  };

  return (
    <div className="ai-composer" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onAddFiles(event.dataTransfer.files); }}>
      <div className="ai-composer__chips">
        {selectedBaseTurnId && <button type="button" className="ai-context-chip" onClick={onClearBase}>基于历史结果修改 <X size={12} /></button>}
        {pendingSelection && <button type="button" className="ai-context-chip" onClick={onClearSelection}>参考当前选区 <X size={12} /></button>}
        {pendingSelectionImage && <span className="ai-context-chip">选区外观</span>}
        {pendingImages.map((image) => <button type="button" className="ai-context-chip" key={image.previewUrl} onClick={() => onRemoveImage(image)}>{image.fileName}<X size={12} /></button>)}
      </div>
      <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} onPaste={handlePaste} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); onSend(); } }} placeholder="描述要生成或修改的内容…" disabled={busy || !hasDetail} />
      <div className="ai-composer__footer">
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { if (event.target.files) onAddFiles(event.target.files); event.target.value = ""; }} />
        <button className="button button--compact" type="button" aria-label="添加截图" title="添加截图" onClick={() => fileInputRef.current?.click()} disabled={busy}><Paperclip size={15} /></button>
        <button className={`button button--compact ${pendingSelection ? "is-active" : ""}`} type="button" aria-label="参考当前选区" title="参考当前选区" disabled={!selectionAvailable || busy} onClick={onToggleSelection}><ScanLine size={15} /></button>
        {pendingSelection && <button className={`button button--compact ${pendingSelectionImage ? "is-active" : ""}`} type="button" aria-label="同时参考选区外观" title="同时参考选区外观" disabled={busy} onClick={onToggleSelectionImage}><FileImage size={15} /></button>}
        <button className="button button--primary button--compact" type="button" aria-label="发送" title="发送 (Ctrl/Cmd + Enter)" disabled={busy || !draft.trim() || !hasDetail} onClick={onSend}><Send size={15} /></button>
      </div>
    </div>
  );
}
