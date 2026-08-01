import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("keeps two editor tabs and native clipboard data across a tab switch", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-tabs-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, DRAWSPACE_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await expect(page.locator(".workspace-page")).toBeVisible();

    const documents = await page.evaluate(async () => {
      const first = await window.desktopApi.documents.create();
      const second = await window.desktopApi.documents.create();
      return [first.document.id, second.document.id];
    });

    await page.evaluate((documentId) => {
      location.hash = `#/editor/${documentId}`;
    }, documents[0]);
    await expect(page.locator(".editor-tab")).toHaveCount(1);

    await page.evaluate((documentId) => {
      location.hash = `#/editor/${documentId}`;
    }, documents[1]);
    await expect(page.locator(".editor-tab")).toHaveCount(2);

    await page.evaluate(async () => {
      await globalThis.navigator.clipboard.writeText("drawspace-native-clipboard");
    });
    await page.locator(".editor-tab").first().click();
    await expect.poll(() => page.evaluate(() => globalThis.navigator.clipboard.readText()))
      .toBe("drawspace-native-clipboard");
  } finally {
    await application?.close();
    await rm(workspacePath, { recursive: true, force: true });
  }
});
