import { AlertCircle, Check, Code2, Copy, FileImage, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiTurn } from "@shared/types";
import type { AiCanvasBridge } from "../AiCanvasBridge";
import { MermaidDiagramAdapter, type ConvertedMermaidDiagram } from "../MermaidDiagramAdapter";

const adapter = new MermaidDiagramAdapter();
const getError = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

interface AiTurnMessageProps {
  turn: AiTurn;
  activeBridge?: AiCanvasBridge;
  activeDocumentId?: string;
  selectionAvailable: boolean;
  onBase: () => void;
  onRepair: (parseError: string) => void;
  onRefresh: () => Promise<void>;
}

export function AiTurnMessage({
  turn,
  activeBridge,
  activeDocumentId,
  selectionAvailable,
  onBase,
  onRepair,
  onRefresh
}: AiTurnMessageProps) {
  const [diagram, setDiagram] = useState<ConvertedMermaidDiagram | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (turn.status !== "ready" || !turn.mermaid) {
      setDiagram(null);
      setError(null);
      return;
    }
    void adapter
      .convert(turn.mermaid)
      .then((result) => {
        if (!disposed) {
          setDiagram(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(getError(reason, "Mermaid 预览转换失败"));
      });
    return () => {
      disposed = true;
    };
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

  const insert = async (mode: "insert" | "replace"): Promise<void> => {
    if (!diagram || !activeBridge || !activeDocumentId) return;
    try {
      activeBridge.insertDiagram(diagram, { mode });
      await window.desktopApi.ai.markTurnInserted(turn.id, activeDocumentId);
      await onRefresh();
      setError(null);
    } catch (reason) {
      setError(getError(reason, mode === "replace" ? "替换选区失败" : "图表插入失败，当前画布未被修改"));
    }
  };

  const copyMermaid = async (): Promise<void> => {
    if (!turn.mermaid) return;
    try {
      await navigator.clipboard.writeText(turn.mermaid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败");
    }
  };

  const displayError = error ?? (turn.status === "error" ? turn.errorMessage ?? "生成失败" : null);

  return (
    <article className="ai-turn">
      <div className="ai-msg ai-msg--user">
        <p className="ai-msg__bubble">{turn.prompt}</p>
        {(turn.context?.selection || turn.attachments.length > 0) && (
          <div className="ai-msg__meta">
            {turn.context?.selection && (
              <span className="ai-context-chip">
                选区 {turn.context.selection.selectedElementCount ?? turn.context.selection.elementCount} 个元素
              </span>
            )}
            {turn.attachments.length > 0 && (
              <span className="ai-context-chip">
                <FileImage size={12} />
                截图 {turn.attachments.length} 张
              </span>
            )}
          </div>
        )}
      </div>

      <div className="ai-msg ai-msg--assistant">
        {turn.status === "generating" && (
          <div className="ai-turn-card__loading">
            <LoaderCircle className="is-spinning" size={17} />
            正在生成图表…
          </div>
        )}

        {turn.status === "ready" && (
          <>
            <p className="ai-msg__reply">已根据你的描述生成图表预览：</p>
            <div className="ai-preview-card">
              {previewUrl && (
                <img className="ai-preview-card__image" src={previewUrl} alt="Mermaid 图表预览" />
              )}
              <div className="ai-preview-card__actions">
                <button
                  className="button button--primary button--compact"
                  type="button"
                  disabled={!diagram || !activeBridge || !activeDocumentId}
                  onClick={() => void insert("insert")}
                >
                  插入到画布
                </button>
                <button
                  className="button button--compact"
                  type="button"
                  disabled={!diagram || !activeBridge || !activeDocumentId || !selectionAvailable}
                  title={selectionAvailable ? "用生成结果替换当前选区" : "请先选中要替换的元素"}
                  onClick={() => void insert("replace")}
                >
                  替换选区
                </button>
                <button className="button button--compact" type="button" onClick={onBase}>
                  基于此修改
                </button>
                <button
                  className="button button--compact"
                  type="button"
                  disabled={!turn.mermaid}
                  onClick={() => void copyMermaid()}
                >
                  <Copy size={14} />
                  {copied ? "已复制" : "复制内容"}
                </button>
                <button
                  className="button button--compact ai-preview-card__source-btn"
                  type="button"
                  onClick={() => setShowSource((value) => !value)}
                >
                  <Code2 size={14} />
                  {showSource ? "隐藏" : "源码"}
                </button>
                {turn.insertedDocumentId && (
                  <span className="ai-inserted-mark">
                    <Check size={13} />
                    已插入
                  </span>
                )}
              </div>
              {showSource && turn.mermaid && <pre className="ai-turn-card__source">{turn.mermaid}</pre>}
            </div>
          </>
        )}

        {displayError && (
          <div className="ai-panel-error">
            <AlertCircle size={15} />
            <span>{displayError}</span>
            {(turn.status === "error" || error) && turn.mermaid && (
              <button
                className="button button--compact"
                type="button"
                onClick={() => onRepair(displayError)}
              >
                <RefreshCw size={14} />
                AI 修复
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
