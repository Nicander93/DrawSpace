# 画伴 CanvasDesk

画伴是一个基于 Excalidraw 的本地优先桌面画布工作区。它在保留 Excalidraw 原生绘图体验的基础上，提供工作区管理、缩略图、搜索、收藏、回收站、可靠保存和异常恢复能力。

![画伴 UI 设计](./ChatGPT%20Image%20Jul%2028%2C%202026%2C%2010_46_28%20AM.png)

## V0 功能

- 选择任意本地文件夹或坚果云本地同步目录作为工作区
- 递归扫描并索引标准 `.excalidraw` 文件
- 新建、打开、重命名、移动、复制、收藏和搜索画布
- 卡片视图、列表视图、最近打开、排序和分页
- 拖拽导入、文件选择导入和同名文件自动避让
- 回收站、恢复、永久删除和清空回收站
- 嵌入官方 Excalidraw 编辑器，支持图片和 BinaryFiles
- 800ms 防抖自动保存、窗口失焦保存和手动保存
- 原子写入、外部修改检测和冲突副本
- 10 秒恢复快照与异常会话恢复提示
- Excalidraw、PNG、SVG 导出
- 浅色、深色主题
- Windows 自定义标题栏、应用图标和 NSIS 安装配置

V0 不包含 OSS、MinIO、WebDAV、账号和多人协作。界面中的远程存储入口只展示版本规划，不会伪装成可用功能。

## 技术栈

- Electron
- React 19
- TypeScript
- Vite / electron-vite
- `@excalidraw/excalidraw`
- SQLite / better-sqlite3
- Zustand
- Zod
- Vitest
- electron-builder

## 项目结构

```text
src/
  main/
    database/       SQLite 索引
    ipc/            参数校验和白名单 IPC
    services/       工作区、文档、缩略图和恢复服务
    storage/        StorageProvider 与本地实现
  preload/          安全桌面 API
  renderer/
    src/
      components/   工作区通用组件
      features/     Excalidraw 适配层
      pages/        欢迎页、工作区、编辑器和设置
      stores/       工作区状态
      styles/       设计系统和页面样式
  shared/           进程共享类型、通道和 Zod Schema
docs/               架构、数据、可靠性和已知问题
```

## 开发环境

- Node.js 20 或 22
- npm 10+
- Windows 10/11 为主要运行和打包平台
- Linux/macOS 可用于开发，但 Windows 安装包建议在 Windows 上生成

## 安装依赖

依赖中包含 Electron 下载和 better-sqlite3 原生模块重建，耗时取决于网络和本机环境：

```bash
npm install
```

`postinstall` 会调用 electron-builder，为当前 Electron 版本重建 better-sqlite3。

## 启动

```bash
npm run dev
```

首次启动后选择一个空目录、现有画布目录或坚果云本地同步目录。

## 检查与测试

```bash
npm run typecheck
npm test
npm run lint
npm run test:e2e
```

SQLite 集成测试依赖完整安装后的 better-sqlite3 原生运行时。如果依赖安装未完成，测试会明确跳过该组，不影响纯存储和参数安全测试。

## 构建

生成主进程、Preload 和 Renderer 产物：

```bash
npm run build
```

生成当前平台的未打包目录：

```bash
npm run package:dir
```

## Windows 安装包

建议在 Windows PowerShell 中执行：

```powershell
npm install
npm run typecheck
npm test
npm run package:win
```

NSIS 安装包输出到 `release/`。安装器支持选择安装目录、桌面快捷方式和开始菜单快捷方式。卸载应用只删除程序和应用数据，不会删除用户选择的工作区目录。

## 数据存储位置

画布正文始终位于用户选择的工作区：

```text
<workspace>/
  *.excalidraw
  .canvasdesk/
    workspace.json
    trash/
```

SQLite、缩略图和恢复快照位于 Electron `userData`：

```text
userData/
  canvasdesk.db
  thumbnails/
  recovery/
```

Windows 默认位于 `%APPDATA%/画伴 CanvasDesk/` 附近，最终目录由 Electron 的 `app.getPath("userData")` 决定。

## 文件格式

主文件为标准 Excalidraw JSON，包含 `type`、`version`、`source`、`elements`、`appState` 和 `files`。收藏、最近打开、删除记录等应用元数据只保存到 SQLite，不污染画布正文。

## 隐私

V0 不包含遥测，不上传画布内容、文件名、路径、图片或凭证。坚果云模式只读写其本地同步目录，跨设备同步由坚果云客户端完成。

## 进一步文档

- [架构说明](docs/architecture.md)
- [StorageProvider](docs/storage-provider.md)
- [SQLite 数据库](docs/database.md)
- [自动保存、冲突与恢复](docs/reliability.md)
- [测试与验收](docs/testing.md)
- [已知问题与 V1 建议](docs/known-issues.md)

## 许可证

[MIT](LICENSE)
