import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("界面缩放后窗口控件、设置入口和画布拖动仍可用", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-ui-scale-workspace-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "drawspace-ui-scale-profile-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, DRAWSPACE_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".workspace-page")).toBeVisible();

    await page.getByRole("button", { name: "设置", exact: true }).click();
    const settingsLayout = await page.locator(".settings-page > main").evaluate((main) => {
      const content = main.querySelector(".settings-content");
      const mainBox = main.getBoundingClientRect();
      const contentBox = content?.getBoundingClientRect();
      return {
        contentOverflowY: content ? globalThis.getComputedStyle(content).overflowY : null,
        hasPageScroll: main.scrollHeight > main.clientHeight,
        mainRight: mainBox.right,
        contentRight: contentBox?.right ?? null
      };
    });
    expect(settingsLayout.contentOverflowY).toBe("visible");
    expect(settingsLayout.hasPageScroll).toBe(true);
    expect(settingsLayout.mainRight).toBeCloseTo(1440);
    expect(settingsLayout.contentRight).toBeLessThan(settingsLayout.mainRight);

    const fontSize = page.locator("#font-size");
    await fontSize.focus();
    await page.keyboard.press("End");
    await expect(page.getByText("130%", { exact: true })).toBeVisible();

    const closeButton = page.locator(".window-controls__close");
    const settingsCloseBox = await closeButton.boundingBox();
    expect(settingsCloseBox).not.toBeNull();
    expect(settingsCloseBox.x + settingsCloseBox.width).toBeLessThanOrEqual(1440);

    await page.getByRole("button", { name: "返回工作区" }).click();
    const settingsButton = page.getByRole("button", { name: "设置", exact: true });
    const settingsBox = await settingsButton.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(900);

    await page.getByRole("button", { name: "新建画布" }).first().click();
    await expect(page.locator(".editor-canvas")).toBeVisible();
    const titlebarAlignment = await page.locator(".editor-workspace__titlebar").evaluate((titlebar) => {
      const back = titlebar.querySelector(".editor-workspace__back");
      const tab = titlebar.querySelector(".editor-tab");
      if (!back || !tab) return null;
      const backBox = back.getBoundingClientRect();
      const tabBox = tab.getBoundingClientRect();
      return Math.abs((backBox.top + backBox.bottom) / 2 - (tabBox.top + tabBox.bottom) / 2);
    });
    expect(titlebarAlignment).not.toBeNull();
    expect(titlebarAlignment).toBeLessThanOrEqual(1);

    await page.locator('input[data-testid="toolbar-rectangle"]').click({ force: true });
    const canvas = page.locator(".excalidraw__canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas is not visible");

    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50);
    await page.mouse.up();
    await expect(page.locator(".editor-workspace__save-status--dirty")).toBeVisible();
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
