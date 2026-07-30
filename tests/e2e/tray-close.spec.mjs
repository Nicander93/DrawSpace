import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("the close button hides the window instead of quitting", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-tray-e2e-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-tray-profile-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, CANVASDESK_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await expect(page.locator(".workspace-page")).toBeVisible();

    await page.locator(".workspace-page .window-controls__close").click();
    await expect.poll(() => application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
    )).toBe(false);
    expect(application.windows()).toHaveLength(1);

    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.show();
      window?.focus();
    });
    await expect(page.locator(".workspace-page")).toBeVisible();
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});