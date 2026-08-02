/* global console, location, process, window */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "assets/screenshots");

function element(partial) {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 1_000_000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...partial
  };
}

function scene(elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "drawspace-screenshot",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
      currentItemFontFamily: 1
    },
    files: {}
  };
}

const samples = [
  {
    name: "系统架构",
    relativePath: "系统架构.excalidraw",
    scene: scene([
      element({
        id: "box-client",
        type: "rectangle",
        x: 80,
        y: 120,
        width: 180,
        height: 100,
        backgroundColor: "#a5d8ff",
        index: "a0"
      }),
      element({
        id: "text-client",
        type: "text",
        x: 120,
        y: 155,
        width: 100,
        height: 30,
        text: "客户�",
        originalText: "客户�",
        fontSize: 24,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 24,
        index: "a1"
      }),
      element({
        id: "arrow-1",
        type: "arrow",
        x: 270,
        y: 170,
        width: 120,
        height: 0,
        points: [
          [0, 0],
          [120, 0]
        ],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
        index: "a2"
      }),
      element({
        id: "box-app",
        type: "rectangle",
        x: 410,
        y: 100,
        width: 220,
        height: 140,
        backgroundColor: "#ffd8a8",
        index: "a3"
      }),
      element({
        id: "text-app",
        type: "text",
        x: 455,
        y: 145,
        width: 130,
        height: 50,
        text: "DrawSpace\n本地工作�",
        originalText: "DrawSpace\n本地工作�",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 20,
        index: "a4"
      }),
      element({
        id: "arrow-2",
        type: "arrow",
        x: 640,
        y: 170,
        width: 120,
        height: 0,
        points: [
          [0, 0],
          [120, 0]
        ],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
        index: "a5"
      }),
      element({
        id: "box-disk",
        type: "rectangle",
        x: 780,
        y: 120,
        width: 180,
        height: 100,
        backgroundColor: "#b2f2bb",
        index: "a6"
      }),
      element({
        id: "text-disk",
        type: "text",
        x: 815,
        y: 155,
        width: 110,
        height: 30,
        text: ".excalidraw",
        originalText: ".excalidraw",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 20,
        index: "a7"
      }),
      element({
        id: "note",
        type: "freedraw",
        x: 120,
        y: 280,
        width: 420,
        height: 80,
        points: [
          [0, 40],
          [40, 10],
          [90, 55],
          [140, 20],
          [200, 60],
          [280, 15],
          [360, 50],
          [420, 30]
        ],
        pressures: [],
        simulatePressure: true,
        strokeColor: "#e03131",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        index: "a8"
      })
    ])
  },
  {
    name: "产品路线图",
    relativePath: "产品设计/产品路线图.excalidraw",
    scene: scene([
      element({
        id: "title",
        type: "text",
        x: 100,
        y: 60,
        width: 280,
        height: 40,
        text: "产品路线图",
        originalText: "产品路线图",
        fontSize: 32,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        baseline: 32,
        strokeColor: "#1971c2",
        index: "b0"
      }),
      element({
        id: "card-1",
        type: "rectangle",
        x: 100,
        y: 140,
        width: 200,
        height: 120,
        backgroundColor: "#d0bfff",
        index: "b1"
      }),
      element({
        id: "card-1-text",
        type: "text",
        x: 125,
        y: 175,
        width: 150,
        height: 50,
        text: "Q1\n工作区管�",
        originalText: "Q1\n工作区管�",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 20,
        index: "b2"
      }),
      element({
        id: "card-2",
        type: "rectangle",
        x: 360,
        y: 140,
        width: 200,
        height: 120,
        backgroundColor: "#99e9f2",
        index: "b3"
      }),
      element({
        id: "card-2-text",
        type: "text",
        x: 390,
        y: 175,
        width: 140,
        height: 50,
        text: "Q2\n多标签编�",
        originalText: "Q2\n多标签编�",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 20,
        index: "b4"
      }),
      element({
        id: "card-3",
        type: "rectangle",
        x: 620,
        y: 140,
        width: 200,
        height: 120,
        backgroundColor: "#ffec99",
        index: "b5"
      }),
      element({
        id: "card-3-text",
        type: "text",
        x: 650,
        y: 175,
        width: 140,
        height: 50,
        text: "Q3\n回收站恢�",
        originalText: "Q3\n回收站恢�",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 20,
        index: "b6"
      })
    ])
  },
  {
    name: "周会纪要",
    relativePath: "会议记录/周会纪要.excalidraw",
    scene: scene([
      element({
        id: "ellipse",
        type: "ellipse",
        x: 220,
        y: 100,
        width: 280,
        height: 180,
        backgroundColor: "#ffc9c9",
        index: "c0"
      }),
      element({
        id: "meeting-text",
        type: "text",
        x: 275,
        y: 165,
        width: 170,
        height: 50,
        text: "周会纪要\n本地优先",
        originalText: "周会纪要\n本地优先",
        fontSize: 24,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 24,
        index: "c1"
      }),
      element({
        id: "line",
        type: "line",
        x: 180,
        y: 340,
        width: 360,
        height: 0,
        points: [
          [0, 0],
          [360, 0]
        ],
        index: "c2"
      }),
      element({
        id: "bullet",
        type: "text",
        x: 200,
        y: 360,
        width: 320,
        height: 80,
        text: "�?自动保存\n�?冲突副本\n�?不上传云�",
        originalText: "�?自动保存\n�?冲突副本\n�?不上传云�",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        baseline: 20,
        index: "c3"
      })
    ])
  },
  {
    name: "快速草稿",
    relativePath: "快速草稿.excalidraw",
    scene: scene([
      element({
        id: "draft-box",
        type: "rectangle",
        x: 160,
        y: 140,
        width: 260,
        height: 140,
        backgroundColor: "#c3fae8",
        index: "d0"
      }),
      element({
        id: "draft-text",
        type: "text",
        x: 220,
        y: 190,
        width: 140,
        height: 30,
        text: "快速草稿",
        originalText: "快速草稿",
        fontSize: 24,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        baseline: 24,
        index: "d1"
      })
    ])
  }
];

async function launchApp({ workspacePath, profilePath }) {
  const env = { ...process.env };
  if (workspacePath) env.DRAWSPACE_E2E_WORKSPACE = workspacePath;
  else delete env.DRAWSPACE_E2E_WORKSPACE;

  const application = await electron.launch({
    cwd: root,
    args: [
      ".",
      `--user-data-dir=${profilePath}`,
      "--disable-gpu",
      "--disable-crash-reporter",
      "--no-sandbox"
    ],
    env
  });
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  return { application, page };
}

async function settle(page, ms = 800) {
  await page.waitForTimeout(ms);
}

async function capture(page, name) {
  await page.screenshot({ path: resolve(outDir, name), type: "png" });
  console.log(`saved ${name}`);
}

async function openByName(page, name) {
  await page.keyboard.press("Escape");
  await settle(page, 200);
  await page.locator(".workspace-search input").fill(name);
  await settle(page, 700);
  await page
    .locator(".app-shell-surface.is-visible .document-card")
    .filter({ hasText: name })
    .first()
    .dblclick();
  await page
    .locator(".editor-document-pane.is-active .excalidraw")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
  await settle(page, 1800);
}

async function saveThumbnailFromCanvas(page) {
  const documentId = await page.evaluate(() => location.hash.split("/").at(-1));
  const buffer = await page
    .locator(".editor-document-pane.is-active .excalidraw")
    .first()
    .screenshot({ type: "png" });
  await page.evaluate(
    async ({ documentId, bytes }) => {
      await window.desktopApi.documents.saveThumbnail(
        documentId,
        new Uint8Array(bytes).buffer
      );
    },
    { documentId, bytes: Array.from(buffer) }
  );
}

async function closeTabAndReturn(page, name) {
  const unsavedSave = page.getByRole("button", { name: "保存", exact: true });
  await page.getByLabel(`关闭 ${name}`).click();
  if (await unsavedSave.isVisible().catch(() => false)) {
    await unsavedSave.click();
    await settle(page, 800);
  }
  const back = page.locator(".editor-workspace__back");
  if (await back.isVisible().catch(() => false)) {
    if (await unsavedSave.isVisible().catch(() => false)) {
      await unsavedSave.click();
      await settle(page, 800);
    }
    await back.click();
  }
  await page
    .locator(".app-shell-surface.is-visible .workspace-sidebar")
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.keyboard.press("Escape");
  await settle(page, 200);
  const clearSearch = page.getByLabel("清除搜索");
  if (await clearSearch.isVisible().catch(() => false)) {
    await clearSearch.click();
  } else {
    await page.locator(".workspace-search input").fill("");
  }
  await settle(page, 800);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const workspacePath = resolve(root, ".screenshot-workspace", "DrawSpace-Demo");
  const profilePath = await mkdtemp(resolve(tmpdir(), "drawspace-shots-profile-"));
  const welcomeProfile = await mkdtemp(resolve(tmpdir(), "drawspace-shots-welcome-"));

  await rm(resolve(root, ".screenshot-workspace"), { recursive: true, force: true });
  await mkdir(resolve(workspacePath, "产品设计"), { recursive: true });
  await mkdir(resolve(workspacePath, "会议记录"), { recursive: true });
  for (const sample of samples) {
    await writeFile(resolve(workspacePath, sample.relativePath), JSON.stringify(sample.scene));
  }

  let application;

  try {
    ({ application } = await launchApp({ workspacePath: null, profilePath: welcomeProfile }));
    let page = await application.firstWindow();
    await page.getByRole("heading", { name: "选择工作�" }).waitFor({ state: "visible", timeout: 20_000 });
    await settle(page, 1000);
    await capture(page, "welcome.png");
    await application.close();
    application = undefined;

    ({ application, page } = await launchApp({ workspacePath, profilePath }));
    await page.getByRole("button", { name: "新建画布" }).first().waitFor({ state: "visible", timeout: 20_000 });
    await settle(page, 1200);

    for (const sample of samples) {
      await openByName(page, sample.name);
      await saveThumbnailFromCanvas(page);
      if (sample.name === "系统架构") {
        await settle(page, 500);
        await capture(page, "editor.png");
      }
      await closeTabAndReturn(page, sample.name);
    }

    await page.evaluate(async () => {
      const result = await window.desktopApi.documents.list({
        filter: "all",
        sort: "nameAsc",
        limit: 50,
        offset: 0
      });
      const target = result.documents.find((document) => document.name === "系统架构");
      if (target && !target.isFavorite) {
        await window.desktopApi.documents.toggleFavorite(target.id);
      }
    });
    await page.getByRole("button", { name: "首页" }).click();
    await settle(page, 1000);
    await capture(page, "workspace.png");

    await page.getByRole("button", { name: "全部画布" }).click();
    await settle(page, 800);
    await capture(page, "workspace-all.png");

    await page.getByLabel("列表视图").click();
    await settle(page, 700);
    await capture(page, "workspace-list.png");

    await page.getByLabel("卡片视图").click();
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("heading", { name: "外观" }).waitFor({ state: "visible" });
    await settle(page, 700);
    await capture(page, "settings.png");

    await page.getByRole("button", { name: "深色" }).click();
    await settle(page, 400);
    await capture(page, "settings-dark.png");
    await page.getByRole("button", { name: "返回工作�" }).click();
    await page
      .locator(".app-shell-surface.is-visible .workspace-sidebar")
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "首页" }).click();
    await settle(page, 1000);
    await capture(page, "workspace-dark.png");
  } finally {
    if (application) {
      await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
      await application.close().catch(() => undefined);
    }
    await rm(resolve(root, ".screenshot-workspace"), { recursive: true, force: true });
    await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(welcomeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
