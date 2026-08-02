/* global document */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("Ctrl+S saves and a recent card reopens the canvas", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-save-e2e-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "drawspace-profile-e2e-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: {
        ...process.env,
        DRAWSPACE_E2E_WORKSPACE: workspacePath
      }
    });
    const page = await application.firstWindow();
    await expect(page.locator(".workspace-page")).toBeVisible();

    await page.getByRole("button", { name: "新建画布" }).first().click();
    await expect(page.locator(".editor-canvas")).toBeVisible();

    await page.locator('input[data-testid="toolbar-rectangle"]').click({ force: true });
    const canvas = page.locator(".excalidraw__canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas is not visible");
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50);
    await page.mouse.up();

    await expect(page.locator(".editor-workspace__save-status--dirty")).toBeVisible();
    const documentId = await page.evaluate(() => location.hash.split("/").at(-1));
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(500);
    const saveState = await page.evaluate(async (id) => {
      const content = await window.desktopApi.documents.open(id);
      const status = document.querySelector(".editor-workspace__save-status");
      return {
        elementCount: content.sceneData.elements.length,
        statusClass: status?.className ?? null,
        statusText: status?.textContent ?? null,
        error: document.querySelector(".editor-error-banner")?.textContent ?? null
      };
    }, documentId);
    expect(saveState).toEqual({
      elementCount: 1,
      statusClass: "editor-workspace__save-status editor-workspace__save-status--saved",
      statusText: "已保存",
      error: null
    });

    const saved = await page.evaluate((id) => window.desktopApi.documents.open(id), documentId);

    await page.locator(".editor-workspace__back").click();
    await expect(page.locator(".workspace-page")).toBeVisible();
    const recentCard = page.locator(".document-card").filter({ hasText: saved.document.name });
    await recentCard.click({ position: { x: 80, y: 80 } });
    await expect(recentCard.locator(".document-card__checkbox")).toBeChecked();
    await recentCard.locator(".document-card__checkbox").click();
    await expect(recentCard.locator(".document-card__checkbox")).not.toBeChecked();
    await recentCard.dblclick({ position: { x: 80, y: 80 } });
    await expect(page.locator(".editor-canvas")).toBeVisible();
    await expect(page.locator(".editor-workspace__save-status--saved")).toContainText("已保存");

    await page.locator(".editor-workspace__back").click();
    await expect(page.locator(".workspace-page")).toBeVisible();
    await expect(page.locator(".modal")).toHaveCount(0);

    await application.evaluate(({ app }) => app.exit(0));
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: {
        ...process.env,
        DRAWSPACE_E2E_WORKSPACE: workspacePath
      }
    });
    const reopenedPage = await application.firstWindow();
    await expect(reopenedPage.locator(".workspace-page")).toBeVisible();
    await reopenedPage.locator(".document-card").filter({ hasText: saved.document.name }).dblclick({ position: { x: 80, y: 80 } });
    await expect(reopenedPage.locator(".editor-canvas")).toBeVisible();
    await expect(reopenedPage.locator(".editor-workspace__save-status--saved")).toContainText("已保存");

    await reopenedPage.locator(".editor-workspace__back").click();
    await expect(reopenedPage.locator(".workspace-page")).toBeVisible();
    await expect(reopenedPage.locator(".modal")).toHaveCount(0);
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
