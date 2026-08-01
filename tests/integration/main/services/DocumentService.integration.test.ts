import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExcalidrawFile } from "@shared/types";
import { DatabaseService } from "@main/database/DatabaseService";
import { DocumentService } from "@main/services/DocumentService";
import { RecoveryService } from "@main/services/RecoveryService";
import { ThumbnailService } from "@main/services/ThumbnailService";
import { WorkspaceService } from "@main/services/WorkspaceService";






const require = createRequire(import.meta.url);
const hasSqliteRuntime = (() => {
  try {
    const Database = require("better-sqlite3") as new (
      filename: string
    ) => { close: () => void };
    const database = new Database(":memory:");
    database.close();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasSqliteRuntime)("DocumentService 本地工作区", () => {
  let testRootPath: string | undefined;
  let workspacePath: string;
  let database: DatabaseService | undefined;
  let workspaceService: WorkspaceService | undefined;
  let recoveryService: RecoveryService;
  let documentService: DocumentService;

  beforeEach(async () => {
    testRootPath = await mkdtemp(resolve(tmpdir(), "drawspace-service-"));
    workspacePath = resolve(testRootPath, "workspace");
    database = new DatabaseService(resolve(testRootPath, "drawspace.db"));
    workspaceService = new WorkspaceService(database);
    recoveryService = new RecoveryService(
      testRootPath,
      database,
      workspaceService
    );
    const thumbnailService = new ThumbnailService(testRootPath, database);
    await Promise.all([recoveryService.initialize(), thumbnailService.initialize()]);
    await workspaceService.activate(workspacePath, "local");
    documentService = new DocumentService(
      database,
      workspaceService,
      recoveryService,
      thumbnailService
    );
  });

  afterEach(async () => {
    await workspaceService?.dispose();
    database?.close();
    if (testRootPath) {
      await rm(testRootPath, { recursive: true, force: true });
    }
  });

  it("创建、重命名、复制、删除和恢复画布", async () => {
    const created = await documentService.create("产品设计");
    expect(created.document.relativePath).toMatch(
      /^产品设计\/未命名画布 .+\.excalidraw$/
    );

    const renamed = await documentService.rename(
      created.document.id,
      "登录流程"
    );
    expect(renamed.relativePath).toBe("产品设计/登录流程.excalidraw");

    const copied = await documentService.copy(renamed.id);
    expect(copied.name).toBe("登录流程 副本");

    await documentService.trash(renamed.id);
    expect(documentService.list({ filter: "trash" }).total).toBe(1);

    const restored = await documentService.restore(renamed.id);
    expect(restored.isDeleted).toBe(false);
    expect(restored.relativePath).toBe("产品设计/登录流程.excalidraw");
  });

  it("外部修改后生成冲突副本而不覆盖原文件", async () => {
    const opened = await documentService.create();
    const provider = workspaceService!.getStorageProvider();
    const externalScene: ExcalidrawFile = {
      ...opened.sceneData,
      elements: [{ id: "external" }]
    };
    await provider.write(
      opened.document.relativePath,
      new TextEncoder().encode(JSON.stringify(externalScene))
    );
    const localScene: ExcalidrawFile = {
      ...opened.sceneData,
      elements: [{ id: "local" }]
    };

    const result = await documentService.save({
      documentId: opened.document.id,
      expectedVersion: opened.version,
      sceneData: localScene
    });

    expect(result.status).toBe("conflict");
    const originalData = JSON.parse(
      new TextDecoder().decode(await provider.read(opened.document.relativePath))
    ) as ExcalidrawFile;
    expect(originalData.elements).toEqual([{ id: "external" }]);
    expect(documentService.list({ filter: "all" }).total).toBe(2);
  });

  it("异常会话的更新快照可被发现", async () => {
    const opened = await documentService.create();
    await documentService.saveRecoverySnapshot({
      documentId: opened.document.id,
      sourcePath: opened.document.relativePath,
      savedAt: Date.now() + 1000,
      sourceModifiedAt: opened.document.modifiedAt,
      sceneData: {
        ...opened.sceneData,
        elements: [{ id: "recoverable" }]
      },
      sessionId: opened.sessionId
    });

    const recoveryItems = await recoveryService.list();
    expect(recoveryItems).toHaveLength(1);
    expect(recoveryItems[0]?.documentName).toBe(opened.document.name);
  });

  it("恢复同名文件时要求明确选择策略", async () => {
    const opened = await documentService.create();
    const originalPath = opened.document.relativePath;
    await documentService.trash(opened.document.id);
    await workspaceService!
      .getStorageProvider()
      .write(originalPath, new TextEncoder().encode(JSON.stringify(opened.sceneData)));

    expect(
      await documentService.hasRestoreConflict(opened.document.id)
    ).toBe(true);
    await expect(documentService.restore(opened.document.id)).rejects.toThrow(
      "请选择重命名或覆盖"
    );

    const restored = await documentService.restore(opened.document.id, "rename");
    expect(restored.relativePath).not.toBe(originalPath);
  });
});
