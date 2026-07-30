import { FileWarning, Star } from "lucide-react";
import type { CanvasDocument } from "@shared/types";
import { formatRelativeTime } from "./DocumentCard";
import { DocumentQuickActions } from "./DocumentQuickActions";

interface DocumentListProps {
  documents: CanvasDocument[];
  selectedDocumentId: string | null;
  selectedDocumentIds?: string[];
  onSelect(documentId: string, event: React.MouseEvent): void;
  onOpen(documentId: string): void;
  onToggleFavorite(documentId: string): void;
  onContextMenu(event: React.MouseEvent, documentId: string): void;
}

export function DocumentList({
  documents,
  selectedDocumentId,
  selectedDocumentIds = selectedDocumentId ? [selectedDocumentId] : [],
  onSelect,
  onOpen,
  onToggleFavorite,
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
          selectedDocumentIds.includes(document.id) ? "is-selected" : ""
          }`}
          key={document.id}
          role="button"
          tabIndex={0}
          onClick={(event) => {
            onSelect(document.id, event);
          }}
          onClickCapture={(event) => {
            const target = event.target as Element;
            if (event.detail === 2 && !target.closest(".document-quick-actions")) onOpen(document.id);
          }}
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
          <DocumentQuickActions isFavorite={document.isFavorite} onToggleFavorite={() => onToggleFavorite(document.id)} onContextMenu={(event) => onContextMenu(event, document.id)} />
        </div>
      ))}
    </div>
  );
}
