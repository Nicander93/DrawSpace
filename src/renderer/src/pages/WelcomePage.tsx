import { Cloud, FolderOpen, Plus, ShieldCheck } from "lucide-react";
import type { Workspace } from "@shared/types";
import { Brand } from "../components/Brand";
import { WindowControls } from "../components/WindowControls";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface WelcomePageProps {
  unavailableWorkspace: Workspace | null;
}

export function WelcomePage({ unavailableWorkspace }: WelcomePageProps) {
  const { chooseWorkspace, error } = useWorkspaceStore();


  return (
    <div className="welcome-page">
      <div className="welcome-titlebar">
        <div className="welcome-titlebar__drag-region" />
        <WindowControls />
      </div>
      <div className="welcome-decoration welcome-decoration--left" />
      <div className="welcome-decoration welcome-decoration--right" />
      <main>
        <Brand />
        <div className="welcome-mascot" aria-hidden="true">
          <span className="welcome-mascot__paper">
            <i className="eye eye--left" />
            <i className="eye eye--right" />
            <i className="smile" />
          </span>
          <span className="welcome-mascot__pencil" />
          <span className="welcome-mascot__leg welcome-mascot__leg--left" />
          <span className="welcome-mascot__leg welcome-mascot__leg--right" />
        </div>
        <h1>
          {unavailableWorkspace
            ? "原工作区暂时找不到了"
            : "让每一个想法，都有画布安放"}
        </h1>
        <p>
          {unavailableWorkspace
            ? `无法访问“${unavailableWorkspace.name}”，请选择它的新位置或打开其他工作区。`
            : "文件保存在你选择的位置，无需账号，也不依赖网络。"}
        </p>
        <div className="welcome-actions">
          <button
            className="welcome-option welcome-option--primary"
            type="button"
            onClick={() => void chooseWorkspace("local")}
          >
            <span><Plus size={23} /></span>
            <div>
              <strong>创建或打开本地工作区</strong>
              <small>选择任意本地文件夹</small>
            </div>
          </button>
          <button
            className="welcome-option"
            type="button"
            onClick={() => void chooseWorkspace("nutstore")}
          >
            <span><Cloud size={23} /></span>
            <div>
              <strong>选择坚果云同步目录</strong>
              <small>由坚果云客户端负责跨设备同步</small>
            </div>
          </button>
          {unavailableWorkspace && (
            <button
              className="welcome-option"
              type="button"
              onClick={() => void chooseWorkspace("local")}
            >
              <span><FolderOpen size={23} /></span>
              <div>
                <strong>修复工作区位置</strong>
                <small title={unavailableWorkspace.rootPath}>
                  原路径：{unavailableWorkspace.rootPath}
                </small>
              </div>
            </button>
          )}
        </div>
        {error && <div className="welcome-error">{error}</div>}
        <footer>
          <ShieldCheck size={15} />
          本地优先 · 标准 Excalidraw 格式 · 你的文件始终属于你
        </footer>
      </main>
    </div>
  );
}
