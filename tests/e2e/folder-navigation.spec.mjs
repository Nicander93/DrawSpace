import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("clicking a sidebar folder filters the workspace", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-folder-e2e-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-profile-e2e-"));
  let application;

  try {
    await mkdir(resolve(workspacePath, "测试"));
    await writeFile(
      resolve(workspacePath, "测试", "目录画布.excalidraw"),
      JSON.stringify({ type: "excalidraw", version: 2, source: "test", elements: [], appState: {}, files: {} })
    );
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, CANVASDESK_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await expect(page.getByRole("button", { name: "打开文件夹 测试" })).toBeVisible();

    await page.getByRole("button", { name: "打开文件夹 测试" }).click();

    await expect(page.locator(".workspace-search input")).toHaveValue("测试");
    await expect(page.getByRole("heading", { name: "搜索“测试”" })).toBeVisible();
    await expect(page.locator(".document-card").filter({ hasText: "目录画布" })).toBeVisible();
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("workspace actions do not overlap the sort control", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-layout-e2e-"));
  const profilePath = await mkdtemp(resolve(tmpdir(), "canvasdesk-profile-e2e-"));
  let application;

  try {
    application = await electron.launch({
      args: [".", `--user-data-dir=${profilePath}`, "--disable-gpu", "--disable-crash-reporter", "--no-sandbox"],
      env: { ...process.env, CANVASDESK_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await page.getByRole("button", { name: "全部画布" }).click();

    const importBox = await page.getByRole("button", { name: "导入", exact: true }).boundingBox();
    const sortBox = await page.locator(".sort-select").boundingBox();
    expect(importBox).not.toBeNull();
    expect(sortBox).not.toBeNull();
    expect(importBox.x + importBox.width <= sortBox.x || sortBox.x + sortBox.width <= importBox.x).toBe(true);
  } finally {
    await application?.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    await rm(workspacePath, { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});