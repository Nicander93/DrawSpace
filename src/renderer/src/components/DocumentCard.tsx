import { FileWarning, Pin, Star } from "lucide-react";
import type { CanvasDocument } from "@shared/types";
import { DocumentQuickActions } from "./DocumentQuickActions";

interface DocumentCardProps {
  document: CanvasDocument;
  selected: boolean;
  onSelect(event: React.MouseEvent): void;
  onOpen(): void;
  onToggleFavorite(): void;
  onContextMenu(event: React.MouseEvent): void;
}

const formatRelativeTime = (timestamp: number): string => {
  const elapsed = Date.now() - timestamp;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric"
  }).format(timestamp);
};

export function DocumentCard({
  document,
  selected,
  onSelect,
  onOpen,
  onToggleFavorite,
  onContextMenu
}: DocumentCardProps) {
  const thumbnailUrl = `canvasdesk://thumbnail/${document.id}?v=${document.modifiedAt}`;

  return (
    <article
      className={`document-card ${selected ? "is-selected" : ""}`}
      tabIndex={0}
      role="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen();
        }
      }}
    >
      <div className="document-card__preview">
        <img
          src={thumbnailUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
        <div className="document-card__placeholder" aria-hidden="true">
          <span className="sketch-note" />
          <span className="sketch-box sketch-box--one" />
          <span className="sketch-box sketch-box--two" />
          <span className="sketch-line sketch-line--one" />
          <span className="sketch-line sketch-line--two" />
          <span className="sketch-arrow">→</span>
        </div>
        {document.syncStatus === "conflict" && (
          <span className="document-card__warning" title="冲突副本">
            <FileWarning size={15} />
          </span>
        )}
        {document.isFavorite && (
          <span className="document-card__pin" title="已收藏">
            <Pin size={15} fill="currentColor" />
          </span>
        )}
        <DocumentQuickActions isFavorite={document.isFavorite} onToggleFavorite={onToggleFavorite} onContextMenu={onContextMenu} />
      </div>
      <div className="document-card__body">
        <div>
          <h3>{document.name}</h3>
        </div>
        <p title={document.relativePath}>{document.relativePath}</p>
        <small>
          {document.isFavorite && <Star size={12} fill="currentColor" />}
          {formatRelativeTime(document.modifiedAt)}
        </small>
      </div>
    </article>
  );
}

export { formatRelativeTime };
