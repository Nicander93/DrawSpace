import { Cloud, FolderOpen, Plus } from "lucide-react";
import type { Workspace } from "@shared/types";
import { Brand } from "../components/Brand";
import { WindowControls } from "../components/WindowControls";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface WelcomePageProps {
  unavailableWorkspace: Workspace | null;
}

/** 选择或恢复本地工作区。 */
export function WelcomePage({ unavailableWorkspace }: WelcomePageProps) {
  const { chooseWorkspace, error } = useWorkspaceStore();

  return (
    <div className="welcome-page">
      <div className="welcome-titlebar">
        <Brand compact />
        <div className="welcome-titlebar__drag-region" />
        <WindowControls />
      </div>
      <main>
        <h1>{unavailableWorkspace ? "原工作区不可用" : "选择工作区"}</h1>
        <p>
          {unavailableWorkspace
            ? `无法访问“${unavailableWorkspace.name}”，请选择它的新位置或打开其他工作区。`
            : "选择一个文件夹存放 .excalidraw 文件。"}
        </p>
        <div className="welcome-actions">
          <button
            className="welcome-option welcome-option--primary"
            type="button"
            onClick={() => void chooseWorkspace("local")}
          >
            <span><Plus size={23} /></span>
            <div>
              <strong>打开本地工作区</strong>
              <small>选择本地文件夹</small>
            </div>
          </button>
          <button
            className="welcome-option"
            type="button"
            onClick={() => void chooseWorkspace("nutstore")}
          >
            <span><Cloud size={23} /></span>
            <div>
              <strong>打开坚果云同步目录</strong>
              <small>由坚果云客户端负责同步</small>
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
                <strong>重新定位工作区</strong>
                <small title={unavailableWorkspace.rootPath}>
                  原路径：{unavailableWorkspace.rootPath}
                </small>
              </div>
            </button>
          )}
        </div>
        {error && <div className="welcome-error">{error}</div>}
      </main>
    </div>
  );
}
