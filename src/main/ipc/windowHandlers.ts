import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/channels";

/**
 * 注册 window:* 通道（最小化 / 最大化切换 / 关闭）。
 * 使用 ipcMain.on 单向通知，无需返回值。
 */
export const registerWindowHandlers = (): void => {
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
};
