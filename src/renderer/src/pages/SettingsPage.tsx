import {
  ArrowLeft,
  Check,
  Cloud,
  FolderOpen,
  HardDrive,
  Moon,
  Sun,
  Monitor
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WindowControls } from "../components/WindowControls";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAppCloseHandler } from "../features/lifecycle/AppCloseContext";
import { useTheme } from "../features/theme/ThemeContext";

export function SettingsPage() {
  const navigate = useNavigate();
  const { workspace, chooseWorkspace } = useWorkspaceStore();
  const { preference, setPreference } = useTheme();

  useAppCloseHandler((request) =>
    window.desktopApi.lifecycle.respondToClose({ requestId: request.requestId, decision: "proceed" })
  );

  return (
    <div className="settings-page">
      <header className="settings-titlebar">
        <button type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={18} />
          返回工作区
        </button>
        <span>设置</span>
        <div className="settings-titlebar__drag-region" />
        <WindowControls />
      </header>
      <main>
        <div className="settings-content">
          <section>
            <h2>外观</h2>
            <p>选择适合你的画布工作区主题。</p>
            <div className="theme-options">
              {([
                { value: "light" as const, label: "浅色", icon: Sun },
                { value: "dark" as const, label: "深色", icon: Moon },
                { value: "system" as const, label: "跟随系统", icon: Monitor }
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  type="button"
                  key={value}
                  className={preference === value ? "is-active" : ""}
                  onClick={() => setPreference(value)}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                  {preference === value && <Check size={16} />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>当前工作区</h2>
            <p>切换前会先结束当前编辑会话，然后重新扫描新目录。</p>
            <div className="current-workspace">
              <span><HardDrive size={22} /></span>
              <div>
                <strong>{workspace?.name}</strong>
                <small>{workspace?.rootPath}</small>
              </div>
              <i>已连接</i>
            </div>
            <div className="settings-actions">
              <button
                className="button"
                type="button"
                onClick={() => void chooseWorkspace("local")}
              >
                <FolderOpen size={16} />
                切换本地工作区
              </button>
              <button
                className="button"
                type="button"
                onClick={() => void chooseWorkspace("nutstore")}
              >
                <Cloud size={16} />
                选择坚果云目录
              </button>
            </div>
          </section>

          <section>
            <h2>隐私</h2>
            <div className="privacy-note">
              画布与应用数据保存在本地，画布文件位于你选择的工作区目录中。
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
