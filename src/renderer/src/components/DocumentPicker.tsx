import { FilePlus2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CanvasDocument } from "@shared/types";
import type { EditorTab } from "../stores/editorStore";
import { Modal } from "./Modal";

interface DocumentPickerProps {
  documents: CanvasDocument[];
  tabs: EditorTab[];
  onOpen(document: CanvasDocument): void;
  onCreate(): void;
  onClose(): void;
}

/** 供编辑器标签栏选择或新建画布。 */
export function DocumentPicker({ documents, tabs, onOpen, onCreate, onClose }: DocumentPickerProps) {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const results = useMemo(() => documents.filter((document) =>
    !document.isDeleted && `${document.name} ${document.relativePath}`.toLowerCase().includes(search.toLowerCase())
  ), [documents, search]);
  const openHighlighted = () => {
    const document = results[highlightedIndex];
    if (document) onOpen(document);
  };

  return (
    <Modal
      title="打开画布"
      onClose={onClose}
      footer={
        <>
          <button className="button" type="button" onClick={onClose}>取消</button>
          <button className="button button--primary" type="button" onClick={onCreate}>
            <FilePlus2 size={16} />
            新建画布
          </button>
        </>
      }
    >
      <input
        className="document-picker__search"
        autoFocus
        placeholder="搜索画布名称或路径"
        value={search}
        role="combobox"
        aria-controls="document-picker-results"
        aria-activedescendant={results[highlightedIndex] ? `document-picker-option-${results[highlightedIndex].id}` : undefined}
        onChange={(event) => { setSearch(event.target.value); setHighlightedIndex(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((index) => results.length === 0 ? 0 : Math.min(index + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            openHighlighted();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <div className="document-picker__results" id="document-picker-results" role="listbox" aria-label="画布结果">
        {results.map((document, index) => {
          const opened = tabs.some((tab) => tab.documentId === document.id);
          return (
            <button
              className={`document-picker__item ${index === highlightedIndex ? "is-highlighted" : ""}`}
              type="button"
              id={`document-picker-option-${document.id}`}
              role="option"
              aria-selected={index === highlightedIndex}
              key={document.id}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => onOpen(document)}
            >
              <span><strong>{document.name}</strong><small>{document.relativePath}</small></span>
              <em>{opened ? "已打开" : document.isFavorite ? "收藏" : document.lastOpenedAt ? "最近打开" : "打开"}</em>
            </button>
          );
        })}
        {results.length === 0 && <p className="empty-hint">没有匹配的画布</p>}
      </div>
    </Modal>
  );
}