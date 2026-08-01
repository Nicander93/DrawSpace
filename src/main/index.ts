import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  nativeImage,
  protocol,
  shell,
  Tray
} from "electron";
import {
  DATABASE_FILENAME,
  E2E_WORKSPACE_ENV,
  PROTOCOL_SCHEME
} from "@shared/brand";
import { appCloseResponseSchema, documentIdSchema } from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import { DatabaseService } from "./database/DatabaseService";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { DocumentService } from "./services/DocumentService";
import { RecoveryService } from "./services/RecoveryService";
import { ThumbnailService } from "./services/ThumbnailService";
import { WorkspaceService } from "./services/WorkspaceService";
import { AppLogger } from "./services/AppLogger";
import { CloseHandshakeController } from "./lifecycle/CloseHandshakeController";

protocol.registerSchemesAsPrivileged([
  {
    scheme: PROTOCOL_SCHEME,
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
let tray: Tray | null = null;
let isQuitting = false;
const closeController = new CloseHandshakeController(randomUUID);

const showMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

const requestApplicationQuit = (): void => {
  isQuitting = true;
  showMainWindow();
  app.quit();
};

const createTray = (): void => {
  if (tray) return;
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "tray-icon.png")
    : join(__dirname, "../../build/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({
    width: process.platform === "darwin" ? 18 : 24,
    height: process.platform === "darwin" ? 18 : 24
  });
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip("DrawSpace");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: showMainWindow
    },
    { type: "separator" },
    {
      label: "退出",
      click: requestApplicationQuit
    }
  ]));
  tray.on("double-click", showMainWindow);
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    frame: false,
    icon: app.isPackaged ? undefined : join(__dirname, "../../build/icon.ico"),
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
  if (!app.isPackaged) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && (input.key === "F12" || input.code === "F12")) {
        event.preventDefault();
        mainWindow?.webContents.toggleDevTools();
      }
    });
  }
  mainWindow.on("close", (event) => {
    const window = mainWindow;
    if (!window || window.isDestroyed()) {
      return;
    }
    if (closeController.isWindowCloseAllowed()) {
      return;
    }
    event.preventDefault();
    if (!isQuitting) {
      window.hide();
      return;
    }
    showMainWindow();
    const request = closeController.begin("app-quit");
    if (request) window.webContents.send(IPC_CHANNELS.appCloseRequested, request);
  });
  const handleCloseResponse = (event: Electron.IpcMainEvent, response: unknown): void => {
    if (event.sender !== mainWindow?.webContents) return;
    const parsedResponse = appCloseResponseSchema.safeParse(response);
    if (!parsedResponse.success) return;
    const result = closeController.respond(parsedResponse.data);
    if (result === "proceed") {
      app.quit();
    } else if (result === "cancel") {
      isQuitting = false;
    }
  };
  ipcMain.on(IPC_CHANNELS.appCloseResponded, handleCloseResponse);
  mainWindow.on("closed", () => {
    ipcMain.removeListener(IPC_CHANNELS.appCloseResponded, handleCloseResponse);
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

/**
 * 初始化应用
 */
const initializeApplication = async (): Promise<void> => {
  const userDataPath = app.getPath("userData");
  logger = new AppLogger(userDataPath);
  await logger.initialize();
  logger.info("app.start", { version: app.getVersion() });
  // 初始化数据库
  database = new DatabaseService(join(userDataPath, DATABASE_FILENAME));
  logger.info("database.migration.success");
  // 初始化工作区服务
  workspaceService = new WorkspaceService(database, logger);
  // 初始化恢复服务
  const recoveryService = new RecoveryService(
    userDataPath,
    database,
    workspaceService
  );
  // 初始化缩略图服务
  const thumbnailService = new ThumbnailService(userDataPath, database);
  // 初始化文档服务
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
  if (process.env[E2E_WORKSPACE_ENV] && !app.isPackaged) {
    await workspaceService.activate(process.env[E2E_WORKSPACE_ENV], "local");
  }
  // 注册 IPC 处理器ob
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

  protocol.handle(PROTOCOL_SCHEME, async (request) => {
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
  createTray();
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  void app
    .whenReady()
    .then(async () => {
      app.setName("DrawSpace");
      app.setAppUserModelId("io.github.nicander93.drawspace");
      await initializeApplication();

      app.on("activate", () => {
        showMainWindow();
      });
    })
    .catch((error) => {
      logger?.error("app.start.failed", error);
      dialog.showErrorBox(
        "应用启动失败",
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

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  tray?.destroy();
  tray = null;
  logger?.info("app.quit");
  void workspaceService?.dispose();
  database?.close();
});
