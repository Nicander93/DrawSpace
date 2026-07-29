import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal__content">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}
