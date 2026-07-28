import {
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Pencil,
  RotateCcw,
  Star,
  Trash2
} from "lucide-react";
import type { CanvasDocument } from "@shared/types";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface DocumentContextMenuProps {
  document: CanvasDocument;
  position: ContextMenuPosition;
  onAction(
    action:
      | "open"
      | "rename"
      | "copy"
      | "move"
      | "favorite"
      | "reveal"
      | "export"
      | "trash"
      | "restore"
      | "delete"
  ): void;
  onClose(): void;
}

export function DocumentContextMenu({
  document,
  position,
  onAction,
  onClose
}: DocumentContextMenuProps) {
  const menuItems = document.isDeleted
    ? [
        { action: "restore" as const, label: "恢复", icon: RotateCcw },
        { action: "delete" as const, label: "永久删除", icon: Trash2, danger: true }
      ]
    : [
        { action: "open" as const, label: "打开", icon: ExternalLink },
        { action: "rename" as const, label: "重命名", icon: Pencil },
        { action: "copy" as const, label: "创建副本", icon: Copy },
        { action: "move" as const, label: "移动到…", icon: FolderInput },
        {
          action: "favorite" as const,
          label: document.isFavorite ? "取消收藏" : "添加收藏",
          icon: Star
        },
        { action: "reveal" as const, label: "在文件管理器中显示", icon: ExternalLink },
        { action: "export" as const, label: "导出画布", icon: Download },
        { action: "trash" as const, label: "移入回收站", icon: Trash2, danger: true }
      ];

  return (
    <div className="context-menu-layer" onMouseDown={onClose}>
      <div
        className="context-menu"
        style={{
          left: Math.min(position.x, window.innerWidth - 230),
          top: Math.min(position.y, window.innerHeight - menuItems.length * 42 - 20)
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {menuItems.map(({ action, label, icon: Icon, danger }) => (
          <button
            type="button"
            key={action}
            className={danger ? "is-danger" : ""}
            onClick={() => onAction(action)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
