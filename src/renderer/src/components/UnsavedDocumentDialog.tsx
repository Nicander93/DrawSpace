import { Modal } from "./Modal";

interface UnsavedDocumentDialogProps {
  documentName: string;
  error?: string | null;
  busy?: boolean;
  onSave(): void;
  onDiscard(): void;
  onCancel(): void;
}

export function UnsavedDocumentDialog({ documentName, error, busy = false, onSave, onDiscard, onCancel }: UnsavedDocumentDialogProps) {
  return (
    <Modal
      title="画布尚未保存"
      onClose={busy ? () => undefined : onCancel}
      footer={
        <>
          <button className="button" type="button" disabled={busy} onClick={onCancel}>取消</button>
          <button className="button button--danger" type="button" disabled={busy} onClick={onDiscard}>不保存并继续</button>
          <button className="button button--primary" type="button" autoFocus disabled={busy} onClick={onSave}>{busy ? "正在保存…" : "保存并继续"}</button>
        </>
      }
    >
      <p>“{documentName}”有尚未保存的修改。</p>
      <p className="muted">如果选择不保存，当前修改将被丢弃。</p>
      {error && <p className="inline-error">{error}</p>}
    </Modal>
  );
}
