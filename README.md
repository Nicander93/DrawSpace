# my-excaildraw-local

基于 Electron 和 Excalidraw 的本地桌面画布工具。项目以用户选择的本地目录为工作区，提供画布管理、编辑、搜索、回收站和可靠保存能力。

## 功能

- 选择本地文件夹作为工作区，递归索引 `.excalidraw` 文件
- 新建、打开、重命名、移动、复制、收藏、搜索和删除画布
- 卡片/列表视图、最近打开、排序、分页和多标签编辑
- 自动保存、串行保存、外部修改检测、冲突副本和异常恢复
- 回收站、恢复、永久删除和清空回收站
- 内嵌 Excalidraw 编辑器，支持 PNG、SVG 和 Excalidraw 导出
- 浅色、深色和跟随系统主题
- Windows 自定义标题栏、托盘和 NSIS 安装包

## 技术栈

- Electron
- React 19、TypeScript
- Vite、electron-vite
- `@excalidraw/excalidraw`
- SQLite、better-sqlite3
- Zustand、Zod
- Vitest、Playwright、electron-builder

## 开发环境

- Node.js 20 或 22
- npm 10 或更高版本
- Windows 10/11 是主要运行和打包平台；Linux/macOS 可用于开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

## 检查与测试

```bash
npm run typecheck
npm test
npm run lint
```

测试代码按执行层级分组：`tests/unit/` 存放单元测试，`tests/integration/` 存放服务与数据库集成测试，`tests/e2e/` 存放 Playwright 端到端测试。`npm test` 只运行前两类，E2E 使用单独脚本。

Electron E2E 测试需要完整安装依赖：

```bash
npm run test:e2e
```

## 构建与打包

生成主进程、预加载脚本和 Renderer 产物：

```bash
npm run build
```

生成当前平台的未打包目录：

```bash
npm run package:dir
```

在 Windows 上生成 NSIS 安装包：

```powershell
npm run package:win
```

打包产物位于 `release/`，该目录已加入 `.gitignore`。打包前请退出正在运行的已打包应用，并避免在编辑器中展开 `release/` 目录，以免文件扫描器锁定 `app.asar`。

## 数据位置

画布正文始终保存在用户选择的工作区：

```text
<workspace>/
  *.excalidraw
  .canvasdesk/
    workspace.json
    trash/
```

SQLite 数据库、缩略图和恢复快照保存在 Electron 的 `userData` 目录，Windows 默认位于 `%APPDATA%/my-excaildraw-local/` 附近。实际路径由 `app.getPath("userData")` 决定。

## 隐私

应用不包含遥测，不会上传画布内容、文件名、路径、图片或凭证。坚果云模式只读写其本地同步目录，跨设备同步由坚果云客户端完成。

## 许可证

[MIT](LICENSE)