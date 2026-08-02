const START_PATTERN = /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\b/i;

export function extractMermaidContent(raw: string): string {
  const source = raw.trim();
  const fenced = source.match(/```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n?```/i);
  const candidate = fenced?.[1]?.trim() ?? source
    .split(/\r?\n/)
    .slice(source.split(/\r?\n/).findIndex((line) => START_PATTERN.test(line.trim())))
    .join("\n")
    .trim();
  if (!candidate || !START_PATTERN.test(candidate)) throw new Error("模型没有返回可识别的 Mermaid 内容");
  if (candidate.length > 50_000) throw new Error("模型返回的 Mermaid 内容过长");
  return candidate;
}
