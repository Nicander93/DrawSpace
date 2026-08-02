import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("创建、保存、回收站、冲突和异常恢复主流程", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-e2e-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: {
        ...process.env,
        DRAWSPACE_E2E_WORKSPACE: workspacePath
      }
    });
    let page = await application.firstWindow();
    await expect(page.getByText("工作区", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "新建画布" }).first().click();
    await expect(page.locator(".editor-canvas")).toBeVisible();

    const documentContent = await page.evaluate(async () => {
      const documentId = location.hash.split("/").at(-1);
      return window.desktopApi.documents.open(documentId);
    });
    const savedResult = await page.evaluate(
      async ({ documentContent }) =>
        window.desktopApi.documents.save({
          documentId: documentContent.document.id,
          expectedVersion: documentContent.version,
          sceneData: {
            ...documentContent.sceneData,
            elements: [
              {
                id: "e2e-element",
                type: "rectangle",
                x: 100,
                y: 100,
                width: 200,
                height: 100,
                angle: 0,
                strokeColor: "#1e1e1e",
                backgroundColor: "#ffd166",
                fillStyle: "solid",
                strokeWidth: 2,
                strokeStyle: "solid",
                roughness: 1,
                opacity: 100,
                groupIds: [],
                frameId: null,
                index: "a0",
                roundness: null,
                seed: 1,
                version: 1,
                versionNonce: 1,
                isDeleted: false,
                boundElements: null,
                updated: Date.now(),
                link: null,
                locked: false
              }
            ]
          }
        }),
      { documentContent }
    );
    expect(savedResult.status).toBe("saved");

    await page.getByRole("button", { name: "工作区" }).click();
    await expect(page.getByText(documentContent.document.name).first()).toBeVisible();

    await page.evaluate(async (documentId) => {
      await window.desktopApi.documents.trash(documentId);
    }, documentContent.document.id);
    await page.getByRole("button", { name: "回收站" }).click();
    await expect(page.getByText(documentContent.document.name).first()).toBeVisible();
    await page.evaluate(async (documentId) => {
      await window.desktopApi.documents.restore(documentId);
    }, documentContent.document.id);

    const reopened = await page.evaluate(async (documentId) => {
      return window.desktopApi.documents.open(documentId);
    }, documentContent.document.id);
    const absolutePath = resolve(workspacePath, reopened.document.relativePath);
    const externalScene = JSON.parse(await readFile(absolutePath, "utf8"));
    externalScene.elements = [{ id: "external-change" }];
    await writeFile(absolutePath, JSON.stringify(externalScene), "utf8");
    const conflictResult = await page.evaluate(
      async ({ reopened }) =>
        window.desktopApi.documents.save({
          documentId: reopened.document.id,
          expectedVersion: reopened.version,
          sceneData: {
            ...reopened.sceneData,
            elements: [{ id: "local-change" }]
          }
        }),
      { reopened }
    );
    expect(conflictResult.status).toBe("conflict");
    expect(JSON.parse(await readFile(absolutePath, "utf8")).elements).toEqual([
      { id: "external-change" }
    ]);

    await page.evaluate(async ({ reopened }) => {
      await window.desktopApi.recovery.save({
        documentId: reopened.document.id,
        sourcePath: reopened.document.relativePath,
        savedAt: Date.now() + 10_000,
        sourceModifiedAt: reopened.document.modifiedAt,
        sceneData: {
          ...reopened.sceneData,
          elements: [{ id: "recoverable-change" }]
        },
        sessionId: reopened.sessionId
      });
    }, { reopened });

    await application.close();
    application = await electron.launch({
      args: [".", "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: {
        ...process.env,
        DRAWSPACE_E2E_WORKSPACE: workspacePath
      }
    });
    page = await application.firstWindow();
    await expect(page.getByText("找到了未保存的画布")).toBeVisible();
  } finally {
    await application?.close();
    await rm(workspacePath, { recursive: true, force: true });
  }
});
