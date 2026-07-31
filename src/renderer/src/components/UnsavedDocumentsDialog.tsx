import type { EditorTab } from "../stores/editorStore";
import { Modal } from "./Modal";

interface UnsavedDocumentsDialogProps {
  tabs: EditorTab[];
  intent?: "exit" | "workspace" | "tabs";
  error?: string | null;
  busy?: boolean;
  onSaveAll(): void;
  onDiscard(): void;
  onCancel(): void;
}

export function UnsavedDocumentsDialog({ tabs, intent = "exit", error, busy = false, onSaveAll, onDiscard, onCancel }: UnsavedDocumentsDialogProps) {
  const leavingWorkspace = intent === "workspace";
  const closingTabs = intent === "tabs";
  return (
    <Modal
      title={leavingWorkspace ? "返回工作区" : closingTabs ? "关闭标签" : "还有画布未保存"}
      onClose={busy ? () => undefined : onCancel}
      footer={
        <>
          <button className="button" type="button" disabled={busy} onClick={onCancel}>取消</button>
          <button className="button button--danger" type="button" disabled={busy} onClick={onDiscard}>不保存</button>
          <button className="button button--primary" type="button" disabled={busy} onClick={onSaveAll}>保存</button>
        </>
      }
    >
      <p>以下画布包含尚未保存的修改：</p>
      <ul className="unsaved-documents-list">
        {tabs.map((tab) => <li key={tab.documentId}><span>{tab.name}</span><small>{tab.saveStatus === "error" ? "保存失败" : tab.saveStatus === "conflict" ? "检测到外部修改" : "未保存"}</small></li>)}
      </ul>
      {error && <p className="inline-error">{error}</p>}
    </Modal>
  );
}
