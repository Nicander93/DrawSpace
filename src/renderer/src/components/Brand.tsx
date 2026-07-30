interface BrandProps {
  compact?: boolean;
}

/** 应用标识，保留原有画板吉祥物与当前项目名称。 */
export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="DrawSpace">
      <div className="brand-mark" aria-hidden="true">
        <span className="brand-mark__eye brand-mark__eye--left" />
        <span className="brand-mark__eye brand-mark__eye--right" />
        <span className="brand-mark__smile" />
        <span className="brand-mark__pencil" />
      </div>
      <strong>DrawSpace</strong>
    </div>
  );
}