import { FileImage, MessageSquare, ScanSearch, Settings2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAiWorkspaceStore } from "../../stores/aiWorkspaceStore";

interface AiCanvasTriggerProps {
  active: boolean;
  hasSelection: boolean;
}

export function AiCanvasTrigger({ active, hasSelection }: AiCanvasTriggerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openPanel = useAiWorkspaceStore((state) => state.openPanel);
  const closePanel = useAiWorkspaceStore((state) => state.closePanel);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleTriggerClick = (): void => {
    if (active) {
      closePanel();
      setMenuOpen(false);
      return;
    }
    setMenuOpen((value) => !value);
  };

  return (
    <div className={`canvas-ai-trigger-wrap ${menuOpen ? "is-open" : ""}`} ref={rootRef}>
      <button
        className={`canvas-ai-trigger ${active || menuOpen ? "is-active" : ""}`}
        type="button"
        title={active ? "关闭 AI 图表助手" : "打开 AI 菜单"}
        aria-label={active ? "关闭 AI 图表助手" : "打开 AI 菜单"}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-pressed={active}
        onClick={handleTriggerClick}
      >
        <Sparkles size={17} />
      </button>
      {menuOpen && (
        <div className="canvas-ai-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openPanel("chat");
              setMenuOpen(false);
            }}
          >
            <MessageSquare size={15} />
            <span>
              <strong>AI 助手</strong>
              <small>对话生成图表</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openPanel("chat", "upload");
              setMenuOpen(false);
            }}
          >
            <FileImage size={15} />
            <span>
              <strong>上传截图生成</strong>
              <small>识别图片为可编辑图</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!hasSelection}
            onClick={() => {
              openPanel("chat", "explain-selection");
              setMenuOpen(false);
            }}
          >
            <ScanSearch size={15} />
            <span>
              <strong>解释选区</strong>
              <small>{hasSelection ? "说明当前选中内容" : "请先选中画布元素"}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openPanel("settings");
              setMenuOpen(false);
            }}
          >
            <Settings2 size={15} />
            <span>
              <strong>AI 设置</strong>
              <small>模型与连接配置</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
