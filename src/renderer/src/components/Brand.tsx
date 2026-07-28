interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand-mark" aria-hidden="true">
        <span className="brand-mark__eye brand-mark__eye--left" />
        <span className="brand-mark__eye brand-mark__eye--right" />
        <span className="brand-mark__smile" />
        <span className="brand-mark__pencil" />
      </div>
      <div>
        <strong>画伴</strong>
        {!compact && <small>轻松画，随心想</small>}
      </div>
    </div>
  );
}
