import {
  ArrowLeft,
  Check,
  FolderOpen,
  HardDrive,
  Moon,
  Sun,
  Monitor,
  Settings2,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WindowControls } from "../components/WindowControls";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useAppCloseHandler } from "../features/lifecycle/AppCloseContext";
import { useTheme } from "../features/theme/ThemeContext";
import type { AiSettings } from "@shared/types";
import { aiSettingsSchema } from "@shared/schemas";

type AiSettingsStatus = "idle" | "loading" | "testing" | "saving" | "success" | "error";
type SettingsCategory = "general" | "ai";

export function SettingsPage() {
  const navigate = useNavigate();
  const { workspace, chooseWorkspace } = useWorkspaceStore();
  const { preference, setPreference } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiStatus, setAiStatus] = useState<AiSettingsStatus>("loading");
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.desktopApi.ai.getSettings().then((settings) => {
      setAiSettings(settings);
      setAiStatus("idle");
    }).catch((error) => {
      setAiStatus("error");
      setAiMessage(error instanceof Error ? error.message : "读取 AI 设置失败");
    });
  }, []);

  const updateAiSetting = <K extends keyof AiSettings>(key: K, value: AiSettings[K]): void => {
    setAiSettings((current) => current ? { ...current, [key]: value } : current);
    setAiStatus("idle");
    setAiMessage(null);
  };

  const saveAiSettings = async (): Promise<void> => {
    if (!aiSettings) return;
    const parsed = aiSettingsSchema.safeParse(aiSettings);
    if (!parsed.success) {
      setAiStatus("error");
      setAiMessage(parsed.error.issues[0]?.message ?? "AI 设置不正确");
      return;
    }
    setAiStatus("saving");
    try {
      const saved = await window.desktopApi.ai.saveSettings(parsed.data);
      setAiSettings(saved);
      setAiStatus("success");
      setAiMessage("AI 设置已保存");
    } catch (error) {
      setAiStatus("error");
      setAiMessage(error instanceof Error ? error.message : "保存 AI 设置失败");
    }
  };

  const testAiConnection = async (): Promise<void> => {
    if (!aiSettings) return;
    const parsed = aiSettingsSchema.safeParse(aiSettings);
    if (!parsed.success) {
      setAiStatus("error");
      setAiMessage(parsed.error.issues[0]?.message ?? "AI 设置不正确");
      return;
    }
    setAiStatus("testing");
    try {
      const result = await window.desktopApi.ai.testConnection(parsed.data);
      setAiStatus(result.success ? "success" : "error");
      setAiMessage(result.message);
    } catch (error) {
      setAiStatus("error");
      setAiMessage(error instanceof Error ? error.message : "连接测试失败");
    }
  };

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
        <aside>
          <nav className="settings-nav" aria-label="设置分类">
            <button
              className={activeCategory === "general" ? "is-active" : ""}
              type="button"
              aria-current={activeCategory === "general" ? "page" : undefined}
              onClick={() => setActiveCategory("general")}
            >
              <Settings2 size={17} />
              常规
            </button>
            <button
              className={activeCategory === "ai" ? "is-active" : ""}
              type="button"
              aria-current={activeCategory === "ai" ? "page" : undefined}
              onClick={() => setActiveCategory("ai")}
            >
              <Sparkles size={17} />
              AI 图表
            </button>
          </nav>
        </aside>
        <div className="settings-content">
          {activeCategory === "ai" && <section className="settings-section--ai">
            <h2>AI 图表</h2>
            <p>通过本地或兼容 OpenAI API 的模型，将自然语言转换为可编辑 Mermaid 图表。</p>
            {aiSettings && (
              <div className="ai-settings-form">
                <label className="field">
                  <span>模型服务地址</span>
                  <input value={aiSettings.baseUrl} onChange={(event) => updateAiSetting("baseUrl", event.target.value)} placeholder="http://127.0.0.1:1234/v1" />
                  <small>LM Studio：127.0.0.1:1234/v1 · Ollama：127.0.0.1:11434/v1</small>
                </label>
                <label className="field">
                  <span>模型名称</span>
                  <input value={aiSettings.model} onChange={(event) => updateAiSetting("model", event.target.value)} placeholder="ornith-1.0-9b" />
                </label>
                <label className="field">
                  <span>视觉模型（可选）</span>
                  <input value={aiSettings.visionModel ?? ""} onChange={(event) => updateAiSetting("visionModel", event.target.value || undefined)} placeholder="默认沿用上面的模型" />
                  <small>截图生成需要 LM Studio 中已加载支持图片的模型；不填则沿用文本模型。</small>
                </label>
                <details className="ai-settings-advanced">
                  <summary>高级设置</summary>
                  <div>
                    <label className="field"><span>Temperature</span><input type="number" min="0" max="2" step="0.1" value={aiSettings.temperature} onChange={(event) => updateAiSetting("temperature", Number(event.target.value))} /></label>
                    <label className="field"><span>超时时间（毫秒）</span><input type="number" min="5000" max="300000" step="1000" value={aiSettings.timeoutMs} onChange={(event) => updateAiSetting("timeoutMs", Number(event.target.value))} /></label>
                  </div>
                </details>
                <div className="settings-actions">
                  <button className="button" type="button" onClick={() => void testAiConnection()} disabled={aiStatus === "testing" || aiStatus === "saving"}>{aiStatus === "testing" ? "正在测试…" : "测试连接"}</button>
                  <button className="button button--primary" type="button" onClick={() => void saveAiSettings()} disabled={aiStatus === "testing" || aiStatus === "saving"}>{aiStatus === "saving" ? "正在保存…" : "保存"}</button>
                </div>
                {aiMessage && <p className={`settings-status settings-status--${aiStatus}`}>{aiMessage}</p>}
              </div>
            )}
          </section>}

          {activeCategory === "general" && <>
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
                onClick={() => void chooseWorkspace()}
              >
                <FolderOpen size={16} />
                切换工作区
              </button>
            </div>
          </section>

          <section>
            <h2>隐私</h2>
            <div className="privacy-note">
              AI 会话历史、Mermaid 和截图附件保存在本机 userData 目录。只有用户明确发送的输入、选区摘要和截图会发送给配置的模型服务，不会发送整个画布、文件路径或工作区内容。数据是否离开本机取决于你配置的模型服务地址。
            </div>
          </section>
          </>}
        </div>
      </main>
    </div>
  );
}
