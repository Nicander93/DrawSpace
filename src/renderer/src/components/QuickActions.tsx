import { FilePlus2, Upload } from "lucide-react";

interface QuickActionsProps {
  onCreate(): void;
  onImport(): void;
}

/** 首页只提供常用画布操作，文件夹管理位于全部画布。 */
export function QuickActions({ onCreate, onImport }: QuickActionsProps) {
  return (
    <section className="quick-actions">
      <h2>快速开始</h2>
      <div>
        <button type="button" className="quick-action quick-action--new" onClick={onCreate}>
          <span><FilePlus2 size={23} /></span>
          <strong>新建画布</strong>
          <small>创建空白画布</small>
        </button>
        <button type="button" className="quick-action" onClick={onImport}>
          <span><Upload size={22} /></span>
          <strong>导入文件</strong>
          <small>打开 .excalidraw</small>
        </button>
      </div>
    </section>
  );
}