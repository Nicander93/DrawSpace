import {
  FilePlus2,
  FolderPlus,
  LayoutGrid,
  Upload
} from "lucide-react";

interface QuickActionsProps {
  onCreate(): void;
  onImport(): void;
  onCreateFolder(): void;
}

export function QuickActions({
  onCreate,
  onImport,
  onCreateFolder
}: QuickActionsProps) {
  return (
    <section className="quick-actions">
      <h2>快速开始</h2>
      <div>
        <button type="button" className="quick-action quick-action--new" onClick={onCreate}>
          <span><FilePlus2 size={23} /></span>
          <strong>新建画布</strong>
          <small>从空白开始创作</small>
        </button>
        <button type="button" className="quick-action" onClick={onImport}>
          <span><Upload size={22} /></span>
          <strong>导入文件</strong>
          <small>打开 .excalidraw</small>
        </button>
        <button type="button" className="quick-action" onClick={onCreateFolder}>
          <span><FolderPlus size={22} /></span>
          <strong>新建文件夹</strong>
          <small>整理你的画布</small>
        </button>
        <button type="button" className="quick-action" disabled title="模板中心将在后续版本提供">
          <span><LayoutGrid size={22} /></span>
          <strong>从模板创建</strong>
          <small>即将支持</small>
        </button>
      </div>
    </section>
  );
}
