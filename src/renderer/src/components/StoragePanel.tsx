import { HardDrive, RefreshCw } from "lucide-react";
import type { Workspace } from "@shared/types";

interface StoragePanelProps {
  workspace: Workspace;
  scanning: boolean;
  onRescan(): void;
}

/** 显示当前工作区的实际本地存储位置。 */
export function StoragePanel({
  workspace,
  scanning,
  onRescan
}: StoragePanelProps) {
  return (
    <aside className="storage-panel">
      <div className="storage-panel__header">
        <h2>存储位置</h2>
        <button type="button" aria-label="重新扫描" onClick={onRescan}>
          <RefreshCw size={15} className={scanning ? "is-spinning" : ""} />
        </button>
      </div>
      <div className="storage-card is-active">
        <span className="storage-card__icon storage-card__icon--local">
          <HardDrive size={24} />
        </span>
        <div>
          <strong>本地工作区</strong>
          <p title={workspace.rootPath}>{workspace.name}</p>
          <small><i /> 已连接</small>
        </div>
      </div>
    </aside>
  );
}