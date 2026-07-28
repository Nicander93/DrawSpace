import {
  Bell,
  CircleHelp,
  Grid2X2,
  List,
  Search,
  X
} from "lucide-react";
import type { DocumentView } from "@shared/types";
import { WindowControls } from "./WindowControls";

interface WorkspaceTopbarProps {
  search: string;
  view: DocumentView;
  onSearchChange(search: string): void;
  onViewChange(view: DocumentView): void;
}

export function WorkspaceTopbar({
  search,
  view,
  onSearchChange,
  onViewChange
}: WorkspaceTopbarProps) {
  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar__drag-region" />
      <div className="workspace-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索画布或文件夹"
          aria-label="搜索画布或文件夹"
        />
        {search && (
          <button
            type="button"
            aria-label="清除搜索"
            onClick={() => onSearchChange("")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <div className="view-switch" aria-label="视图切换">
        <button
          type="button"
          aria-label="卡片视图"
          className={view === "grid" ? "is-active" : ""}
          onClick={() => onViewChange("grid")}
        >
          <Grid2X2 size={16} />
        </button>
        <button
          type="button"
          aria-label="列表视图"
          className={view === "list" ? "is-active" : ""}
          onClick={() => onViewChange("list")}
        >
          <List size={17} />
        </button>
      </div>
      <button className="topbar-icon" type="button" aria-label="帮助">
        <CircleHelp size={18} />
      </button>
      <button className="topbar-icon" type="button" aria-label="通知">
        <Bell size={17} />
      </button>
      <WindowControls />
    </header>
  );
}
