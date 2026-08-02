import { Sparkles } from "lucide-react";

export function AiCanvasTrigger({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      className={`canvas-ai-trigger ${active ? "is-active" : ""}`}
      type="button"
      title="打开 AI 图表助手"
      aria-label="打开 AI 图表助手"
      aria-pressed={active}
      onClick={onClick}
    >
      <Sparkles size={17} />
    </button>
  );
}
