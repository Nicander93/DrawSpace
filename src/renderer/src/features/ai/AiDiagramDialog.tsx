import { AlertCircle, Check, Code2, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiSelectionContext } from "@shared/types";
import { MermaidDiagramAdapter, type ConvertedMermaidDiagram } from "./MermaidDiagramAdapter";

type DialogStatus = "idle" | "generating" | "converting" | "repairing" | "ready" | "error";

interface AiDiagramDialogProps {
  selection?: AiSelectionContext;
  onClose: () => void;
  onInsert: (diagram: ConvertedMermaidDiagram) => void;
}

const adapter = new MermaidDiagramAdapter();

export function AiDiagramDialog({ selection, onClose, onInsert }: AiDiagramDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [useSelection, setUseSelection] = useState(Boolean(selection));
  const [mermaid, setMermaid] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [status, setStatus] = useState<DialogStatus>("idle");
  const [diagram, setDiagram] = useState<ConvertedMermaidDiagram | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!diagram?.svg) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([diagram.svg], { type: "image/svg+xml" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [diagram]);

  const convert = async (source: string): Promise<void> => {
    setStatus("converting");
    try {
      const converted = await adapter.convert(source);
      setDiagram(converted);
      setMermaid(source);
      setParseError(null);
      setStatus("ready");
    } catch (error) {
      setDiagram(null);
      setParseError(error instanceof Error ? error.message : "Mermaid 转换失败");
      setStatus("error");
    }
  };

  const generate = async (): Promise<void> => {
    if (prompt.trim().length < 3 || status === "generating" || status === "converting" || status === "repairing") return;
    setStatus("generating");
    setParseError(null);
    try {
      const result = await window.desktopApi.ai.generateMermaid({ prompt, selection: useSelection ? selection : undefined });
      await convert(result.mermaid);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "AI 图表生成失败");
      setStatus("error");
    }
  };

  const repair = async (): Promise<void> => {
    if (!mermaid || !parseError || status === "repairing") return;
    setStatus("repairing");
    try {
      const result = await window.desktopApi.ai.repairMermaid({ prompt, mermaid, parseError, selection: useSelection ? selection : undefined });
      await convert(result.mermaid);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "AI 修复失败");
      setStatus("error");
    }
  };

  const busy = status === "generating" || status === "converting" || status === "repairing";
  return (
    <div className="ai-diagram-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <section className="ai-diagram-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-diagram-title">
        <header className="ai-diagram-dialog__header">
          <div><Sparkles size={18} /><div><h2 id="ai-diagram-title">AI 生成图表</h2><span>自然语言 → Mermaid → 可编辑 Excalidraw 元素</span></div></div>
          <button className="editor-icon-button" type="button" aria-label="关闭" onClick={onClose} disabled={busy}><X size={18} /></button>
        </header>
        <div className="ai-diagram-dialog__body">
          <div className="ai-diagram-dialog__input">
            <label htmlFor="ai-diagram-prompt">描述你想生成的图表</label>
            <textarea id="ai-diagram-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：画一个用户登录系统时序图，包含浏览器、网关、认证服务和数据库。" disabled={busy} />
            {selection && <label className="ai-selection-toggle"><input type="checkbox" checked={useSelection} onChange={(event) => setUseSelection(event.target.checked)} disabled={busy} />参考当前选区（只发送文字和关系摘要）</label>}
            <div className="ai-diagram-dialog__actions">
              <button className="button button--primary" type="button" onClick={() => void generate()} disabled={busy || prompt.trim().length < 3}><Sparkles size={16} />{busy ? (status === "repairing" ? "正在修复…" : "正在生成…") : "生成图表"}</button>
              {mermaid && <button className="button" type="button" onClick={() => setShowSource((value) => !value)}><Code2 size={16} />{showSource ? "隐藏 Mermaid" : "查看 Mermaid"}</button>}
            </div>
            {showSource && <pre className="ai-diagram-dialog__mermaid">{mermaid}</pre>}
          </div>
          <div className="ai-diagram-dialog__preview">
            <div className="ai-diagram-dialog__preview-title"><span>预览</span>{status === "ready" && <span className="ai-diagram-success"><Check size={14} />可插入</span>}</div>
            {previewUrl ? <img src={previewUrl} alt="生成的 Mermaid 图表预览" /> : <div className="ai-diagram-empty">{busy ? <><LoaderCircle className="is-spinning" size={24} />{status === "converting" ? "正在转换 Mermaid…" : "正在请求模型…"}</> : "生成后将在这里显示预览"}</div>}
            {parseError && <div className="ai-diagram-dialog__error"><AlertCircle size={16} /><span>{parseError}</span>{mermaid && <button className="button" type="button" onClick={() => void repair()} disabled={busy}><RefreshCw size={14} />AI 修复</button>}</div>}
            <div className="ai-diagram-dialog__footer"><button className="button" type="button" onClick={onClose} disabled={busy}>取消</button><button className="button button--primary" type="button" onClick={() => diagram && onInsert(diagram)} disabled={!diagram || busy}>插入画布</button></div>
          </div>
        </div>
      </section>
    </div>
  );
}
