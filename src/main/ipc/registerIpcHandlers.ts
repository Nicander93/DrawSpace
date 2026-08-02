import { createIpcHandle } from "./registerHandle";
import { registerDocumentHandlers } from "./documentHandlers";
import { registerRecoveryHandlers } from "./recoveryHandlers";
import { registerWindowHandlers } from "./windowHandlers";
import { registerWorkspaceHandlers } from "./workspaceHandlers";
import { registerAiHandlers } from "./aiHandlers";
import { registerAiConversationHandlers } from "./aiConversationHandlers";
import type { IpcServices } from "./types";

export type { IpcServices } from "./types";

/** 汇总注册全部 IPC 通道，按功能模块分发给对应 handler */
export const registerIpcHandlers = (services: IpcServices): void => {
  const handle = createIpcHandle(services.logger);

  registerWorkspaceHandlers(handle, services.workspaceService);
  registerDocumentHandlers(handle, {
    documentService: services.documentService,
    workspaceService: services.workspaceService,
    thumbnailService: services.thumbnailService
  });
  registerRecoveryHandlers(handle, {
    documentService: services.documentService,
    recoveryService: services.recoveryService
  });
  registerWindowHandlers();
  registerAiHandlers(handle, services.aiDiagramService);
  registerAiConversationHandlers(handle, services.aiConversationService);
};
