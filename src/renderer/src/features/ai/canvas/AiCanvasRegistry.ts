import type { AiCanvasBridge } from "../AiCanvasBridge";

type Listener = () => void;

class AiCanvasRegistry {
  private readonly bridges = new Map<string, AiCanvasBridge>();
  private readonly listeners = new Set<Listener>();

  register(documentId: string, bridge: AiCanvasBridge): () => void {
    this.bridges.set(documentId, bridge);
    this.emit();
    return () => {
      if (this.bridges.get(documentId) !== bridge) return;
      this.bridges.delete(documentId);
      this.emit();
    };
  }

  get(documentId: string | undefined): AiCanvasBridge | undefined {
    return documentId ? this.bridges.get(documentId) : undefined;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const aiCanvasRegistry = new AiCanvasRegistry();
