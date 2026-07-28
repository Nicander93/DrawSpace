import { FilePlus2, Upload } from "lucide-react";

interface EmptyStateProps {
  isTrash?: boolean;
  onCreate(): void;
  onImport(): void;
}

export function EmptyState({ isTrash = false, onCreate, onImport }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__illustration">
        <span className="empty-paper">
          <i />
          <i />
        </span>
        <span className="empty-pencil" />
      </div>
      <h2>{isTrash ? "回收站是空的" : "这里还没有画布"}</h2>
      <p>
        {isTrash
          ? "移入回收站的画布会暂时保留在这里。"
          : "创建你的第一个画布，或者导入已有的 .excalidraw 文件。"}
      </p>
      {!isTrash && (
        <div>
          <button className="button button--primary" type="button" onClick={onCreate}>
            <FilePlus2 size={17} />
            新建画布
          </button>
          <button className="button" type="button" onClick={onImport}>
            <Upload size={17} />
            导入文件
          </button>
        </div>
      )}
    </div>
  );
}
