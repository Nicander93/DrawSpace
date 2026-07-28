import { Cloud, CloudCog, HardDrive, RefreshCw } from "lucide-react";
import type { Workspace } from "@shared/types";

interface StoragePanelProps {
  workspace: Workspace;
  scanning: boolean;
  onRescan(): void;
}

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
          <strong>{workspace.providerType === "nutstore" ? "坚果云目录" : "本地工作区"}</strong>
          <p title={workspace.rootPath}>{workspace.name}</p>
          <small><i /> 已连接</small>
        </div>
      </div>
      <div className="storage-card storage-card--planned">
        <span className="storage-card__icon storage-card__icon--cloud">
          <Cloud size={23} />
        </span>
        <div>
          <strong>OSS / MinIO</strong>
          <p>兼容对象存储</p>
          <small>V1 即将支持</small>
        </div>
      </div>
      <div className="storage-card storage-card--planned">
        <span className="storage-card__icon storage-card__icon--webdav">
          <CloudCog size={23} />
        </span>
        <div>
          <strong>WebDAV</strong>
          <p>自托管同步</p>
          <small>后续版本</small>
        </div>
      </div>
    </aside>
  );
}
