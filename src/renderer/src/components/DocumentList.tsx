import { FileWarning, MoreHorizontal, Star } from "lucide-react";
import type { CanvasDocument } from "@shared/types";
import { formatRelativeTime } from "./DocumentCard";

interface DocumentListProps {
  documents: CanvasDocument[];
  selectedDocumentId: string | null;
  onSelect(documentId: string): void;
  onOpen(documentId: string): void;
  onContextMenu(event: React.MouseEvent, documentId: string): void;
}

export function DocumentList({
  documents,
  selectedDocumentId,
  onSelect,
  onOpen,
  onContextMenu
}: DocumentListProps) {
  return (
    <div className="document-list">
      <div className="document-list__header">
        <span>名称</span>
        <span>位置</span>
        <span>修改时间</span>
        <span />
      </div>
      {documents.map((document) => (
        <div
          className={`document-list__row ${
            selectedDocumentId === document.id ? "is-selected" : ""
          }`}
          key={document.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(document.id)}
          onDoubleClick={() => onOpen(document.id)}
          onContextMenu={(event) => onContextMenu(event, document.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen(document.id);
          }}
        >
          <span className="document-list__name">
            <span className="mini-canvas">
              <i />
              <i />
            </span>
            <strong>{document.name}</strong>
            {document.isFavorite && <Star size={14} fill="currentColor" />}
            {document.syncStatus === "conflict" && <FileWarning size={14} />}
          </span>
          <span title={document.relativePath}>{document.relativePath}</span>
          <span>{formatRelativeTime(document.modifiedAt)}</span>
          <button
            type="button"
            aria-label="更多操作"
            onClick={(event) => onContextMenu(event, document.id)}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}
