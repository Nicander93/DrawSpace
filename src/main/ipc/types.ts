import type { DocumentService } from "../services/DocumentService";
import type { RecoveryService } from "../services/RecoveryService";
import type { ThumbnailService } from "../services/ThumbnailService";
import type { WorkspaceService } from "../services/WorkspaceService";
import type { AppLogger } from "../services/AppLogger";

/** IPC 层依赖的主进程服务集合 */
export interface IpcServices {
  workspaceService: WorkspaceService;
  documentService: DocumentService;
  recoveryService: RecoveryService;
  thumbnailService: ThumbnailService;
  logger?: AppLogger;
}

/** 统一的 invoke 通道注册签名（已绑定 logger） */
export type IpcHandle = (
  channel: string,
  handler: (...args: unknown[]) => unknown
) => void;
