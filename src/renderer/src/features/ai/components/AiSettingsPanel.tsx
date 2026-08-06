import { useEffect, useState } from "react";
import type { AiSettings } from "@shared/types";
import { aiSettingsSchema } from "@shared/schemas";

type Status = "idle" | "loading" | "testing" | "saving" | "success" | "error";

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.desktopApi.ai
      .getSettings()
      .then((next) => {
        setSettings(next);
        setStatus("idle");
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "读取 AI 设置失败");
      });
  }, []);

  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]): void => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setStatus("idle");
    setMessage(null);
  };

  const save = async (): Promise<void> => {
    if (!settings) return;
    const parsed = aiSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "AI 设置不正确");
      return;
    }
    setStatus("saving");
    try {
      const saved = await window.desktopApi.ai.saveSettings(parsed.data);
      setSettings(saved);
      setStatus("success");
      setMessage("AI 设置已保存");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "保存 AI 设置失败");
    }
  };

  const test = async (): Promise<void> => {
    if (!settings) return;
    const parsed = aiSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "AI 设置不正确");
      return;
    }
    setStatus("testing");
    try {
      const result = await window.desktopApi.ai.testConnection(parsed.data);
      setStatus(result.success ? "success" : "error");
      setMessage(result.message);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "连接测试失败");
    }
  };

  if (!settings) {
    return (
      <div className="ai-settings-panel">
        <p className="ai-settings-panel__status">{message ?? "正在加载设置…"}</p>
      </div>
    );
  }

  return (
    <div className="ai-settings-panel">
      <h3>AI 设置</h3>
      <p className="ai-settings-panel__hint">配置本地或兼容 OpenAI API 的模型服务。</p>
      <label className="field">
        <span>模型服务地址</span>
        <input
          value={settings.baseUrl}
          onChange={(event) => update("baseUrl", event.target.value)}
          placeholder="http://127.0.0.1:1234/v1"
        />
      </label>
      <label className="field">
        <span>模型名称</span>
        <input
          value={settings.model}
          onChange={(event) => update("model", event.target.value)}
          placeholder="ornith-1.0-9b"
        />
      </label>
      <label className="field">
        <span>视觉模型（可选）</span>
        <input
          value={settings.visionModel ?? ""}
          onChange={(event) => update("visionModel", event.target.value || undefined)}
          placeholder="默认沿用上面的模型"
        />
      </label>
      <details className="ai-settings-panel__advanced">
        <summary>高级设置</summary>
        <div className="ai-settings-panel__advanced-fields">
          <label className="field">
            <span>Temperature</span>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(event) => update("temperature", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>超时（毫秒）</span>
            <input
              type="number"
              min="5000"
              max="300000"
              step="1000"
              value={settings.timeoutMs}
              onChange={(event) => update("timeoutMs", Number(event.target.value))}
            />
          </label>
        </div>
      </details>
      <div className="ai-settings-panel__actions">
        <button
          className="button button--compact"
          type="button"
          disabled={status === "testing" || status === "saving"}
          onClick={() => void test()}
        >
          {status === "testing" ? "测试中…" : "测试连接"}
        </button>
        <button
          className="button button--primary button--compact"
          type="button"
          disabled={status === "testing" || status === "saving"}
          onClick={() => void save()}
        >
          {status === "saving" ? "保存中…" : "保存"}
        </button>
      </div>
      {message && <p className={`ai-settings-panel__status is-${status}`}>{message}</p>}
    </div>
  );
}
