import { describe, expect, it } from "vitest";
import {
  appCloseResponseSchema,
  excalidrawFileSchema,
  fileNameSchema,
  relativeDirectorySchema
} from "./schemas";

describe("IPC 参数校验", () => {
  it("只接受当前关闭握手的有效响应结构", () => {
    expect(appCloseResponseSchema.safeParse({ requestId: "stale", decision: "proceed" }).success).toBe(false);
    expect(appCloseResponseSchema.safeParse({ requestId: "00000000-0000-0000-0000-000000000000", decision: "cancel" }).success).toBe(true);
  });

  it("拒绝路径穿越和绝对路径", () => {
    expect(relativeDirectorySchema.safeParse("../secret").success).toBe(false);
    expect(relativeDirectorySchema.safeParse("/etc").success).toBe(false);
    expect(relativeDirectorySchema.safeParse("产品/原型").success).toBe(true);
  });

  it("拒绝 Windows 非法文件名", () => {
    expect(fileNameSchema.safeParse("系统:架构").success).toBe(false);
    expect(fileNameSchema.safeParse("系统架构图").success).toBe(true);
  });

  it("只接受标准 Excalidraw 主文件结构", () => {
    expect(
      excalidrawFileSchema.safeParse({
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: {},
        files: {}
      }).success
    ).toBe(true);
    expect(
      excalidrawFileSchema.safeParse({ type: "private-canvas", elements: [] })
        .success
    ).toBe(false);
    expect(
      excalidrawFileSchema.parse({
        type: "excalidraw",
        version: 1,
        elements: []
      }).files
    ).toEqual({});
  });
});
