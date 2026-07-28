import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell
} from "electron";
import { z } from "zod";
import {
  documentIdSchema,
  documentListQuerySchema,
  exportAssetSchema,
  fileNameSchema,
  importBufferSchema,
  recoverySnapshotSchema,
  relativeDirectorySchema,
  saveDocumentInputSchema,
  workspaceProviderTypeSchema
} from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import type { DocumentService } from "../services/DocumentService";
import type { RecoveryService } from "../services/RecoveryService";
import type { ThumbnailService } from "../services/ThumbnailService";
import type { WorkspaceService } from "../services/WorkspaceService";
import type { AppLogger } from "../services/AppLogger";

interface IpcServices {
  workspaceService: WorkspaceService;
  documentService: DocumentService;
  recoveryService: RecoveryService;
  thumbnailService: ThumbnailService;
  logger?: AppLogger;
}

const registerHandle = (
  channel: string,
  handler: (...args: unknown[]) => unknown,
  logger?: AppLogger
): void => {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger?.error(`ipc.${channel}.failed`, error);
      throw error;
    }
  });
};

export const registerIpcHandlers = (services: IpcServices): void => {
  const {
    workspaceService,
    documentService,
    recoveryService,
    thumbnailService
  } = services;
  const handle = (
    channel: string,
    handler: (...args: unknown[]) => unknown
  ): void => registerHandle(channel, handler, services.logger);

  handle(IPC_CHANNELS.workspaceGetActive, () =>
    workspaceService.getActiveWorkspace()
  );
  handle(IPC_CHANNELS.workspaceChoose, async (providerTypeInput) => {
    const providerType = workspaceProviderTypeSchema
      .optional()
      .parse(providerTypeInput) ?? "local";
    const result = await dialog.showOpenDialog({
      title:
        providerType === "nutstore"
          ? "选择坚果云本地同步目录"
          : "选择本地工作区",
      properties: ["openDirectory", "createDirectory"]
    });
    const rootPath = result.filePaths[0];
    if (result.canceled || !rootPath) {
      return null;
    }
    return workspaceService.activate(rootPath, providerType);
  });
  handle(IPC_CHANNELS.workspaceRescan, () => workspaceService.scan());
  handle(IPC_CHANNELS.workspaceListDirectories, () =>
    workspaceService.listDirectories()
  );
  handle(
    IPC_CHANNELS.workspaceCreateDirectory,
    (relativeDirectoryInput) =>
      workspaceService.createDirectory(
        relativeDirectorySchema.parse(relativeDirectoryInput)
      )
  );

  handle(IPC_CHANNELS.documentsList, (queryInput) =>
    documentService.list(documentListQuerySchema.parse(queryInput))
  );
  handle(IPC_CHANNELS.documentsCreate, (relativeDirectoryInput) =>
    documentService.create(
      relativeDirectorySchema.optional().parse(relativeDirectoryInput)
    )
  );
  handle(IPC_CHANNELS.documentsOpen, (documentIdInput) =>
    documentService.open(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.documentsSave, (input) =>
    documentService.save(saveDocumentInputSchema.parse(input))
  );
  handle(IPC_CHANNELS.documentsRename, (documentIdInput, nameInput) =>
    documentService.rename(
      documentIdSchema.parse(documentIdInput),
      fileNameSchema.parse(nameInput)
    )
  );
  handle(
    IPC_CHANNELS.documentsMove,
    (documentIdInput, relativeDirectoryInput) =>
      documentService.move(
        documentIdSchema.parse(documentIdInput),
        relativeDirectorySchema.parse(relativeDirectoryInput)
      )
  );
  handle(IPC_CHANNELS.documentsCopy, (documentIdInput) =>
    documentService.copy(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.documentsToggleFavorite, (documentIdInput) =>
    documentService.toggleFavorite(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.documentsTrash, (documentIdInput) =>
    documentService.trash(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.documentsHasRestoreConflict, (documentIdInput) =>
    documentService.hasRestoreConflict(documentIdSchema.parse(documentIdInput))
  );
  handle(
    IPC_CHANNELS.documentsRestore,
    (documentIdInput, conflictStrategyInput) =>
      documentService.restore(
        documentIdSchema.parse(documentIdInput),
        z
          .enum(["rename", "overwrite"])
          .optional()
          .parse(conflictStrategyInput)
      )
  );
  handle(IPC_CHANNELS.documentsDeletePermanently, (documentIdInput) =>
    documentService.deletePermanently(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.documentsEmptyTrash, () =>
    documentService.emptyTrash()
  );
  handle(IPC_CHANNELS.documentsReveal, (documentIdInput) => {
    const documentId = documentIdSchema.parse(documentIdInput);
    const document = documentService.getDocument(documentId);
    shell.showItemInFolder(
      workspaceService.resolveAbsolutePath(document.relativePath)
    );
  });
  handle(IPC_CHANNELS.documentsImportDialog, async () => {
    const result = await dialog.showOpenDialog({
      title: "导入 Excalidraw 画布",
      filters: [{ name: "Excalidraw 画布", extensions: ["excalidraw"] }],
      properties: ["openFile", "multiSelections"]
    });
    if (result.canceled) {
      return [];
    }
    const importedDocuments = [];
    for (const filePath of result.filePaths) {
      const data = await readFile(filePath);
      if (data.byteLength > 50 * 1024 * 1024) {
        throw new Error(`${basename(filePath)} 超过 50 MB 限制`);
      }
      importedDocuments.push(
        await documentService.import(basename(filePath), data)
      );
    }
    return importedDocuments;
  });
  handle(
    IPC_CHANNELS.documentsImportBuffer,
    async (fileNameInput, dataInput) => {
      const { fileName, data } = importBufferSchema.parse({
        fileName: fileNameInput,
        data: dataInput
      });
      return documentService.import(fileName, new Uint8Array(data));
    }
  );
  handle(IPC_CHANNELS.documentsExportFile, async (documentIdInput) => {
    const documentId = documentIdSchema.parse(documentIdInput);
    const document = documentService.getDocument(documentId);
    const result = await dialog.showSaveDialog({
      title: "导出 Excalidraw 画布",
      defaultPath: `${document.name}.excalidraw`,
      filters: [{ name: "Excalidraw 画布", extensions: ["excalidraw"] }]
    });
    if (result.canceled || !result.filePath) {
      return false;
    }
    await writeFile(result.filePath, await documentService.getFileData(documentId));
    return true;
  });
  handle(
    IPC_CHANNELS.documentsExportAsset,
    async (documentIdInput, formatInput, dataInput) => {
      const { documentId, format, data } = exportAssetSchema.parse({
        documentId: documentIdInput,
        format: formatInput,
        data: dataInput
      });
      const document = documentService.getDocument(documentId);
      const result = await dialog.showSaveDialog({
        title: `导出 ${format.toUpperCase()}`,
        defaultPath: `${document.name}.${format}`,
        filters: [
          {
            name: format === "png" ? "PNG 图片" : "SVG 图片",
            extensions: [format]
          }
        ]
      });
      if (result.canceled || !result.filePath) {
        return false;
      }
      await writeFile(
        result.filePath,
        typeof data === "string" ? data : new Uint8Array(data)
      );
      return true;
    }
  );
  handle(
    IPC_CHANNELS.documentsSaveThumbnail,
    async (documentIdInput, dataInput) => {
      const documentId = documentIdSchema.parse(documentIdInput);
      const data = zodArrayBuffer(dataInput);
      if (data.byteLength > 5 * 1024 * 1024) {
        throw new Error("缩略图文件过大");
      }
      await thumbnailService.save(documentId, new Uint8Array(data));
    }
  );

  handle(IPC_CHANNELS.recoveryList, () => recoveryService.list());
  handle(IPC_CHANNELS.recoverySave, (snapshotInput) =>
    documentService.saveRecoverySnapshot(
      recoverySnapshotSchema.parse(snapshotInput)
    )
  );
  handle(IPC_CHANNELS.recoveryRestore, (documentIdInput) =>
    documentService.restoreRecovery(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.recoveryDiscard, (documentIdInput) =>
    recoveryService.discard(documentIdSchema.parse(documentIdInput))
  );
  handle(IPC_CHANNELS.sessionsClose, (sessionIdInput) => {
    const sessionId = documentIdSchema.parse(sessionIdInput);
    documentService.closeSession(sessionId);
  });

  ipcMain.on(IPC_CHANNELS.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on(IPC_CHANNELS.windowMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });
  ipcMain.on(IPC_CHANNELS.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.on(IPC_CHANNELS.appReadyToClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.destroy();
  });
};

const zodArrayBuffer = (value: unknown): ArrayBuffer => {
  if (!(value instanceof ArrayBuffer)) {
    throw new Error("无效的二进制数据");
  }
  return value;
};
