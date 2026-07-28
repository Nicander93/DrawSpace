import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  return (
    <div className="window-controls">
      <button
        type="button"
        aria-label="最小化"
        onClick={() => window.desktopApi.window.minimize()}
      >
        <Minus size={15} />
      </button>
      <button
        type="button"
        aria-label="最大化"
        onClick={() => window.desktopApi.window.maximize()}
      >
        <Square size={13} />
      </button>
      <button
        type="button"
        className="window-controls__close"
        aria-label="关闭"
        onClick={() => window.desktopApi.window.close()}
      >
        <X size={16} />
      </button>
    </div>
  );
}
