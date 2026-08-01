import { dialog } from "electron";
import { relativeDirectorySchema } from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import type { WorkspaceService } from "../services/WorkspaceService";
import type { IpcHandle } from "./types";

/** 注册 workspace:* 通道：激活工作区、扫描、目录管理 */
export const registerWorkspaceHandlers = (
  handle: IpcHandle,
  workspaceService: WorkspaceService
): void => {
  handle(IPC_CHANNELS.workspaceGetActive, () =>
    workspaceService.getActiveWorkspace()
  );

  // 弹出系统目录选择框，确认后激活为本地工作区
  handle(IPC_CHANNELS.workspaceChoose, async () => {
    const result = await dialog.showOpenDialog({
      title: "选择工作区",
      properties: ["openDirectory", "createDirectory"]
    });
    const rootPath = result.filePaths[0];
    if (result.canceled || !rootPath) {
      return null;
    }
    return workspaceService.activate(rootPath, "local");
  });

  handle(IPC_CHANNELS.workspaceRescan, () => workspaceService.scan());

  handle(IPC_CHANNELS.workspaceListDirectories, () =>
    workspaceService.listDirectories()
  );

  handle(IPC_CHANNELS.workspaceCreateDirectory, (relativeDirectoryInput) =>
    workspaceService.createDirectory(
      relativeDirectorySchema.parse(relativeDirectoryInput)
    )
  );
};
