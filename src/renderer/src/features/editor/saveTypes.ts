import type { ExcalidrawFile } from "@shared/types";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";
export type SaveReason =
  | "auto-debounce"
  | "auto-max-wait"
  | "manual"
  | "leave-editor"
  | "switch-workspace"
  | "close-window"
  | "exit-app"
  | "retry";

export interface SaveSnapshot {
  revision: number;
  documentId: string;
  expectedVersion: string;
  sceneData: ExcalidrawFile;
  reason: SaveReason;
}

export type SaveOutcome =
  | { status: "saved" | "noop" }
  | { status: "conflict"; persisted: boolean; message: string }
  | { status: "failed"; message: string };
