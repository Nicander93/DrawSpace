import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  net,
  protocol,
  shell
} from "electron";
import { documentIdSchema } from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import { DatabaseService } from "./database/DatabaseService";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { DocumentService } from "./services/DocumentService";
import { RecoveryService } from "./services/RecoveryService";
import { ThumbnailService } from "./services/ThumbnailService";
import { WorkspaceService } from "./services/WorkspaceService";
import { AppLogger } from "./services/AppLogger";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "canvasdesk",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let database: DatabaseService | null = null;
let workspaceService: WorkspaceService | null = null;
let logger: AppLogger | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: "#f7f6f3",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  let closeRequested = false;
  mainWindow.on("close", (event) => {
    if (closeRequested || mainWindow?.isDestroyed()) {
      return;
    }
    event.preventDefault();
    closeRequested = true;
    mainWindow?.webContents.send("app:close-requested");
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
      }
    }, 5_000);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocolName = new URL(url).protocol;
      if (protocolName === "https:" || protocolName === "http:") {
        void shell.openExternal(url);
      }
    } catch {
      return { action: "deny" };
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (url === currentUrl) {
      return;
    }
    event.preventDefault();
    try {
      const protocolName = new URL(url).protocol;
      if (protocolName === "https:" || protocolName === "http:") {
        void shell.openExternal(url);
      }
    } catch {
      return;
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
};

const initializeApplication = async (): Promise<void> => {
  const userDataPath = app.getPath("userData");
  logger = new AppLogger(userDataPath);
  await logger.initialize();
  logger.info("app.start", { version: app.getVersion() });
  database = new DatabaseService(join(userDataPath, "canvasdesk.db"));
  logger.info("database.migration.success");
  workspaceService = new WorkspaceService(database, logger);
  const recoveryService = new RecoveryService(
    userDataPath,
    database,
    workspaceService
  );
  const thumbnailService = new ThumbnailService(userDataPath, database);
  const documentService = new DocumentService(
    database,
    workspaceService,
    recoveryService,
    thumbnailService,
    logger
  );

  await Promise.all([
    workspaceService.initialize(),
    recoveryService.initialize(),
    thumbnailService.initialize()
  ]);
  if (
    process.env.CANVASDESK_E2E_WORKSPACE &&
    !app.isPackaged
  ) {
    await workspaceService.activate(
      process.env.CANVASDESK_E2E_WORKSPACE,
      "local"
    );
  }

  registerIpcHandlers({
    workspaceService,
    documentService,
    recoveryService,
    thumbnailService,
    logger
  });
  workspaceService.onIndexChanged(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.workspaceIndexChanged);
    }
  });

  protocol.handle("canvasdesk", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== "thumbnail") {
        return new Response("Not found", { status: 404 });
      }
      const documentId = documentIdSchema.parse(
        requestUrl.pathname.replace(/^\//, "")
      );
      const thumbnailPath = thumbnailService.getThumbnailPath(documentId);
      if (!existsSync(thumbnailPath)) {
        return new Response("Not found", { status: 404 });
      }
      return net.fetch(pathToFileURL(thumbnailPath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  createWindow();
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("com.canvasdesk.app");
      await initializeApplication();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    })
    .catch((error) => {
      logger?.error("app.start.failed", error);
      dialog.showErrorBox(
        "画伴启动失败",
        error instanceof Error ? error.message : "无法初始化应用数据"
      );
      app.quit();
    });
}

process.on("uncaughtException", (error) => {
  logger?.error("app.uncaught-exception", error);
});

process.on("unhandledRejection", (error) => {
  logger?.error("app.unhandled-rejection", error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  logger?.info("app.quit");
  void workspaceService?.dispose();
  database?.close();
});
