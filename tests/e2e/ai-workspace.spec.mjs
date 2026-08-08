import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("AI workspace keeps visual inputs gated and visually integrated", async () => {
  const workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-ai-workspace-"));
  const userDataPath = await mkdtemp(resolve(tmpdir(), "drawspace-ai-user-data-"));
  const modelServer = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      choices: [{ message: { content: "flowchart LR\nA[输入] --> B[处理] --> C[输出]" } }]
    }));
  });
  await new Promise((resolveListen) => modelServer.listen(0, "127.0.0.1", resolveListen));
  const address = modelServer.address();
  const modelBaseUrl = `http://127.0.0.1:${address.port}/v1`;
  let application;

  try {
    application = await electron.launch({
      args: [
        ".",
        `--user-data-dir=${userDataPath}`,
        "--disable-gpu",
        "--disable-crash-reporter",
        "--no-sandbox"
      ],
      env: { ...process.env, DRAWSPACE_E2E_WORKSPACE: workspacePath }
    });
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".workspace-page")).toBeVisible();
    await page.evaluate(async (baseUrl) => {
      const current = await window.desktopApi.ai.getSettings();
      await window.desktopApi.ai.saveSettings({ ...current, baseUrl, model: "e2e-text-model" });
    }, modelBaseUrl);

    const documentId = await page.evaluate(async () => {
      const created = await window.desktopApi.documents.create();
      return created.document.id;
    });
    await page.evaluate((id) => {
      location.hash = `#/editor/${id}`;
    }, documentId);
    await expect(page.locator(".editor-workspace")).toBeVisible();

    await page.getByRole("button", { name: "打开 AI 菜单" }).click();
    await page.getByRole("menuitem", { name: /AI 助手/ }).click();
    await expect(page.locator(".ai-workspace-panel")).toBeVisible();
    await expect(page.getByText("AI 图表助手", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("描述你想要的图表…")).toBeVisible();

    const historyToggle = page.getByRole("button", { name: "历史对话", exact: true });
    await expect(historyToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#ai-conversation-history")).toHaveCount(0);
    await historyToggle.click();
    const historyDrawer = page.getByRole("navigation", { name: "历史对话" });
    await expect(historyDrawer).toBeVisible();
    const activeHistoryToggle = page.getByRole("button", { name: "收起历史对话" }).first();
    await expect(activeHistoryToggle).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const activeHistoryToggleBox = await activeHistoryToggle.boundingBox();
    expect(activeHistoryToggleBox?.y).toBeGreaterThan(44);
    await expect(historyDrawer.getByRole("button", { name: "收起历史对话" })).toBeFocused();
    await page.waitForTimeout(220);
    if (process.env.DRAWSPACE_AI_HISTORY_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_AI_HISTORY_SCREENSHOT, fullPage: true });
    }
    await historyDrawer.getByRole("button", { name: "收起历史对话" }).click();
    await expect(historyDrawer).toHaveCount(0);
    await expect(historyToggle).toBeFocused();

    await historyToggle.click();
    await historyDrawer.locator(".ai-session-item > button").first().click();
    await expect(historyDrawer).toHaveCount(0);
    await expect(page.getByPlaceholder("描述你想要的图表…")).toBeFocused();

    const settings = await page.evaluate(() => window.desktopApi.ai.getSettings());
    expect(settings.visionModel).toBeUndefined();
    const uploadButton = page.getByRole("button", { name: "上传截图生成图表" });
    await expect(uploadButton).toHaveAttribute("aria-disabled", "true");
    await expect(uploadButton).toHaveAttribute("title", "需要先配置视觉模型");

    if (process.env.DRAWSPACE_AI_EMPTY_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_AI_EMPTY_SCREENSHOT, fullPage: true });
    }

    await uploadButton.click({ force: true });
    await expect(page.getByText(/尚未配置视觉模型/)).toBeVisible();
    if (process.env.DRAWSPACE_AI_ERROR_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_AI_ERROR_SCREENSHOT, fullPage: true });
    }

    await page.getByRole("button", { name: "AI 设置" }).click();
    await expect(page.getByPlaceholder("例如：支持图片输入的模型名称")).toBeVisible();
    await expect(page.getByText("用于截图理解和选区外观参考。未配置时仍可正常使用文本生成，但截图和选区外观功能不可用。")).toBeVisible();
    if (process.env.DRAWSPACE_AI_SETTINGS_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_AI_SETTINGS_SCREENSHOT, fullPage: true });
    }

    await page.getByRole("button", { name: "AI 设置" }).click();
    const composer = page.getByPlaceholder("描述你想要的图表…");
    await composer.fill("生成一个输入、处理和输出的流程图");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await expect(page.getByText("已为你生成图表预览如下：", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Mermaid 图表预览" })).toBeVisible();
    await expect(page.getByRole("button", { name: "放入画布" })).toBeVisible();
    if (process.env.DRAWSPACE_AI_RESULT_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_AI_RESULT_SCREENSHOT, fullPage: true });
    }

    await page.getByRole("button", { name: "工作区", exact: true }).click();
    await expect(page.locator(".workspace-page")).toBeVisible();
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await expect(page.locator(".settings-page")).toBeVisible();
    await page.getByRole("button", { name: "AI 图表", exact: true }).click();
    await expect(page.getByPlaceholder("例如：支持图片输入的模型名称")).toBeVisible();
    if (process.env.DRAWSPACE_SETTINGS_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_SETTINGS_SCREENSHOT, fullPage: true });
    }
    await page.getByRole("button", { name: "常规", exact: true }).click();
    await expect(page.getByRole("heading", { name: "外观", exact: true })).toBeVisible();
    if (process.env.DRAWSPACE_SETTINGS_GENERAL_SCREENSHOT) {
      await page.screenshot({ path: process.env.DRAWSPACE_SETTINGS_GENERAL_SCREENSHOT, fullPage: true });
    }
  } finally {
    await application?.close();
    await new Promise((resolveClose) => modelServer.close(resolveClose));
    await rm(workspacePath, { recursive: true, force: true });
    await rm(userDataPath, { recursive: true, force: true });
  }
});
