import {
  Clock3,
  Grid2X2,
  Home,
  Settings,
  Star,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DocumentFilter } from "@shared/types";
import { Brand } from "./Brand";

interface WorkspaceSidebarProps {
  activeFilter: DocumentFilter;
  onFilterChange(filter: DocumentFilter): void;
}

const navigationItems: Array<{
  filter: DocumentFilter;
  label: string;
  icon: typeof Home;
}> = [
  { filter: "home", label: "首页", icon: Home },
  { filter: "all", label: "全部画布", icon: Grid2X2 },
  { filter: "recent", label: "最近打开", icon: Clock3 },
  { filter: "favorites", label: "收藏夹", icon: Star },
  { filter: "trash", label: "回收站", icon: Trash2 }
];

/** 应用级导航仅保留固定视图，文件夹在全部画布中管理。 */
export function WorkspaceSidebar({ activeFilter, onFilterChange }: WorkspaceSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar__drag-region" />
      <Brand compact />
      <nav className="workspace-sidebar__nav">
        {navigationItems.map(({ filter, label, icon: Icon }) => (
          <button
            type="button"
            key={filter}
            className={activeFilter === filter ? "is-active" : ""}
            onClick={() => onFilterChange(filter)}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="workspace-sidebar__footer">
        <button
          className="workspace-sidebar__settings"
          type="button"
          onClick={() => navigate("/settings")}
        >
          <Settings size={18} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}