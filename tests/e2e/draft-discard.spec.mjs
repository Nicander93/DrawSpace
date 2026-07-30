import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("discarding a new draft removes it from all canvases", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-draft-e2e-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-draft-profile-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, CANVASDESK_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await expect(page.locator(".workspace-page")).toBeVisible();

    await page.locator(".quick-action--new").click();
    await expect(page.locator(".editor-canvas")).toBeVisible();
    await expect(page.locator(".editor-workspace__save-status--dirty")).toBeVisible();

    await page.locator(".editor-workspace__back").click();
    const dialog = page.locator(".modal");
    await expect(dialog).toBeVisible();
    await dialog.locator("footer button").nth(1).click();

    await expect(page.locator(".workspace-page")).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const result = await window.desktopApi.documents.list({ filter: "all" });
      return result.total;
    })).toBe(0);

    await page.locator(".quick-action--new").click();
    await expect(page.locator(".editor-canvas")).toBeVisible();
    await page.locator(".editor-workspace__back").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("footer button").first()).toBeEnabled();
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
