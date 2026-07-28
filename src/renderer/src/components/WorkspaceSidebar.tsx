import {
  Clock3,
  Folder,
  FolderOpen,
  Grid2X2,
  Home,
  MoreHorizontal,
  Settings,
  Star,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DocumentFilter, Workspace } from "@shared/types";
import { Brand } from "./Brand";

interface WorkspaceSidebarProps {
  workspace: Workspace;
  activeFilter: DocumentFilter;
  directories: string[];
  onFilterChange(filter: DocumentFilter): void;
  onCreateInFolder(relativeDirectory: string): void;
}

const navigationItems: Array<{
  filter: DocumentFilter;
  label: string;
  icon: typeof Home;
}> = [
  { filter: "home", label: "工作区", icon: Home },
  { filter: "all", label: "全部画布", icon: Grid2X2 },
  { filter: "recent", label: "最近打开", icon: Clock3 },
  { filter: "favorites", label: "收藏夹", icon: Star },
  { filter: "trash", label: "回收站", icon: Trash2 }
];

export function WorkspaceSidebar({
  workspace,
  activeFilter,
  directories,
  onFilterChange,
  onCreateInFolder
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const folders = directories.slice(0, 6);

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

      <div className="sidebar-section">
        <div className="sidebar-section__title">
          <span>文件夹</span>
          <button type="button" aria-label="文件夹操作">
            <MoreHorizontal size={16} />
          </button>
        </div>
        {folders.length > 0 ? (
          folders.map((folder) => (
            <div className="sidebar-folder" key={folder}>
              <Folder size={17} />
              <span title={folder}>{folder}</span>
              <button
                type="button"
                title={`在 ${folder} 中新建画布`}
                aria-label={`在 ${folder} 中新建画布`}
                onClick={() => onCreateInFolder(folder)}
              >
                +
              </button>
            </div>
          ))
        ) : (
          <div className="sidebar-folder sidebar-folder--muted">
            <FolderOpen size={17} />
            <span>画布都在根目录</span>
          </div>
        )}
      </div>

      <div className="workspace-sidebar__footer">
        <div className="workspace-avatar">小</div>
        <div className="workspace-user">
          <strong>小画家</strong>
          <span title={workspace.rootPath}>{workspace.name}</span>
        </div>
        <button
          type="button"
          aria-label="设置"
          onClick={() => navigate("/settings")}
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
