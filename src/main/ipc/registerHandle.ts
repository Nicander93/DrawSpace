import { ipcMain } from "electron";
import type { AppLogger } from "../services/AppLogger";
import type { IpcHandle } from "./types";

/**
 * 创建带日志的 ipcMain.handle 注册器。
 * 重复注册时先 removeHandler，避免热重载/多次启动残留旧 handler。
 */
export const createIpcHandle = (logger?: AppLogger): IpcHandle => {
  return (channel, handler) => {
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
};
