import { MoreHorizontal, Star } from "lucide-react";

interface DocumentQuickActionsProps {
  isFavorite: boolean;
  onToggleFavorite(): void;
  onContextMenu(event: React.MouseEvent): void;
}

export function DocumentQuickActions({ isFavorite, onToggleFavorite, onContextMenu }: DocumentQuickActionsProps) {
  return (
    <div className="document-quick-actions" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={isFavorite ? "取消收藏" : "收藏"} title={isFavorite ? "取消收藏" : "收藏"} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleFavorite(); }}>
        <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <button type="button" aria-label="更多操作" title="更多操作" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(event); }}>
        <MoreHorizontal size={17} />
      </button>
    </div>
  );
}
