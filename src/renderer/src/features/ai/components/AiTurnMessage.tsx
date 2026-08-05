import { AlertCircle, Check, Code2, FileImage, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiTurn } from "@shared/types";
import type { AiCanvasBridge } from "../AiCanvasBridge";
import { MermaidDiagramAdapter, type ConvertedMermaidDiagram } from "../MermaidDiagramAdapter";

const adapter = new MermaidDiagramAdapter();
const getError = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

interface AiTurnMessageProps {
  turn: AiTurn;
  activeBridge?: AiCanvasBridge;
  activeDocumentId?: string;
  onBase: () => void;
  onRepair: (parseError: string) => void;
  onRefresh: () => Promise<void>;
}

export function AiTurnMessage({ turn, activeBridge, activeDocumentId, onBase, onRepair, onRefresh }: AiTurnMessageProps) {
  const [diagram, setDiagram] = useState<ConvertedMermaidDiagram | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    if (turn.status !== "ready" || !turn.mermaid) {
      setDiagram(null);
      setError(null);
      return;
    }
    void adapter.convert(turn.mermaid)
      .then((result) => {
        if (!disposed) {
          setDiagram(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(getError(reason, "Mermaid 预览转换失败"));
      });
    return () => { disposed = true; };
  }, [turn.mermaid, turn.status]);

  useEffect(() => {
    if (!diagram?.svg) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([diagram.svg], { type: "image/svg+xml" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [diagram]);

  const insert = async (): Promise<void> => {
    if (!diagram || !activeBridge || !activeDocumentId) return;
    try {
      activeBridge.insertDiagram(diagram);
      await window.desktopApi.ai.markTurnInserted(turn.id, activeDocumentId);
      await onRefresh();
      setError(null);
    } catch (reason) {
      setError(getError(reason, "图表插入失败，当前画布未被修改"));
    }
  };

  return (
    <article className="ai-turn-card">
      <div className="ai-turn-card__header">
        <span className="ai-turn-card__prompt">{turn.prompt}</span>
        <span className={`ai-turn-status ai-turn-status--${turn.status}`}>
          {turn.status === "generating" ? "生成中" : turn.status === "ready" ? "已完成" : turn.status === "error" ? "失败" : "已取消"}
        </span>
      </div>
      {turn.context?.selection && <span className="ai-context-chip">选区 {turn.context.selection.selectedElementCount ?? turn.context.selection.elementCount} 个元素</span>}
      {turn.attachments.length > 0 && <span className="ai-context-chip"><FileImage size={12} />截图 {turn.attachments.length} 张</span>}
      {turn.status === "generating" && <div className="ai-turn-card__loading"><LoaderCircle className="is-spinning" size={17} />正在生成图表…</div>}
      {(turn.status === "error" || error) && <div className="ai-panel-error"><AlertCircle size={15} /><span>{error ?? turn.errorMessage ?? "生成失败"}</span>{turn.mermaid && <button className="button button--compact" type="button" onClick={() => onRepair(error ?? turn.errorMessage ?? "Mermaid 转换失败")}><RefreshCw size={14} />AI 修复</button>}</div>}
      {previewUrl && <img className="ai-turn-card__preview" src={previewUrl} alt="Mermaid 图表预览" />}
      {error && <div className="ai-panel-error"><AlertCircle size={15} />{error}</div>}
      {showSource && turn.mermaid && <pre className="ai-turn-card__source">{turn.mermaid}</pre>}
      {turn.status === "ready" && <div className="ai-turn-card__actions">
        <button className="button button--compact" type="button" onClick={() => setShowSource((value) => !value)}><Code2 size={14} />{showSource ? "隐藏 Mermaid" : "查看 Mermaid"}</button>
        <button className="button button--compact" type="button" onClick={onBase}>基于此修改</button>
        <button className="button button--primary button--compact" type="button" disabled={!diagram || !activeBridge || !activeDocumentId} onClick={() => void insert()}>插入当前画布</button>
        {turn.insertedDocumentId && <span className="ai-inserted-mark"><Check size={13} />已插入</span>}
      </div>}
    </article>
  );
}
