import { Check, Circle, FileWarning, LoaderCircle, Plus, X } from "lucide-react";
import type { EditorTab } from "../stores/editorStore";

interface EditorTabsProps {
  tabs: EditorTab[];
  activeDocumentId: string | null;
  onActivate(documentId: string): void;
  onClose(documentId: string): void;
  onAdd(): void;
  onReorder(fromIndex: number, toIndex: number): void;
  onContextMenu(tab: EditorTab, event: React.MouseEvent): void;
}

const StatusIcon = ({ tab }: { tab: EditorTab }) => {
  if (tab.saveStatus === "saving") return <LoaderCircle size={13} className="is-spinning" />;
  if (tab.saveStatus === "dirty") return <Circle size={10} fill="currentColor" />;
  if (tab.saveStatus === "error" || tab.saveStatus === "conflict") return <FileWarning size={13} />;
  return <Check size={13} />;
};

export function EditorTabs({ tabs, activeDocumentId, onActivate, onClose, onAdd, onReorder, onContextMenu }: EditorTabsProps) {
  return (
    <div className="editor-tabs" role="tablist" aria-label="已打开画布">
      {tabs.map((tab, index) => (
        <button
          className={`editor-tab ${tab.documentId === activeDocumentId ? "is-active" : ""}`}
          key={tab.documentId}
          type="button"
          role="tab"
          aria-selected={tab.documentId === activeDocumentId}
          title={`${tab.name}\n${tab.relativePath}`}
          draggable
          onClick={() => onActivate(tab.documentId)}
          onDoubleClick={(event) => {
            event.preventDefault();
            onActivate(tab.documentId);
            window.dispatchEvent(new CustomEvent("canvasdesk:request-rename", { detail: tab.documentId }));
          }}
          onContextMenu={(event) => { event.preventDefault(); onContextMenu(tab, event); }}
          onMouseDown={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              onClose(tab.documentId);
            }
          }}
          onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const from = Number(event.dataTransfer.getData("text/plain"));
            if (Number.isInteger(from)) onReorder(from, index);
          }}
        >
          <StatusIcon tab={tab} />
          <span>{tab.name}</span>
          <span
            className="editor-tab__close"
            role="button"
            aria-label={`关闭 ${tab.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.documentId);
            }}
          >
            <X size={14} />
          </span>
        </button>
      ))}
      <button className="editor-tabs__add" type="button" aria-label="打开画布" onClick={onAdd}>
        <Plus size={17} />
      </button>
    </div>
  );
}
