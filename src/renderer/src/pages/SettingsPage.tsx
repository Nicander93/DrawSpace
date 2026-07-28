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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WindowControls } from "../components/WindowControls";
import { useWorkspaceStore } from "../stores/workspaceStore";

type Theme = "light" | "dark" | "system";

export function SettingsPage() {
  const navigate = useNavigate();
  const { workspace, chooseWorkspace } = useWorkspaceStore();
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("canvasdesk-theme") as Theme | null) ?? "system"
  );

  useEffect(
    () =>
      window.desktopApi.lifecycle.onCloseRequested(() => {
        window.desktopApi.lifecycle.readyToClose();
      }),
    []
  );

  const changeTheme = (nextTheme: Theme): void => {
    setTheme(nextTheme);
    localStorage.setItem("canvasdesk-theme", nextTheme);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme =
      nextTheme === "system" ? (systemDark ? "dark" : "light") : nextTheme;
  };

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
        <aside>
          <h1>设置</h1>
          <button className="is-active" type="button">常规</button>
          <button type="button">存储与工作区</button>
          <button type="button">关于画伴</button>
        </aside>
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
                  className={theme === value ? "is-active" : ""}
                  onClick={() => changeTheme(value)}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                  {theme === value && <Check size={16} />}
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
              画伴 V0 不收集画布内容、文件名或文件路径。所有画布都保存在你选择的目录中。
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
