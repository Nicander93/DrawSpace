# 架构说明

画伴采用 Electron Main、Preload、Renderer 三层结构。

Renderer 只负责 React 界面、Excalidraw、内存编辑状态和导出渲染。它无法访问 Node.js 全局对象或文件系统。

Preload 通过 `contextBridge` 暴露 `window.desktopApi`。API 使用固定 IPC 通道，不向页面暴露通用 `invoke`。

Main 负责系统文件选择器、SQLite、工作区扫描、文件监听、原子写入、恢复快照、缩略图和窗口生命周期。BrowserWindow 开启：

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
```

## 主要调用链

```text
React 页面
  -> window.desktopApi
  -> Preload 白名单
  -> IPC Zod 校验
  -> DocumentService / WorkspaceService
  -> StorageProvider / DatabaseService
  -> 本地文件和 SQLite
```

`DocumentService` 不直接依赖 Node.js `fs`。工作区文件读写统一通过 `StorageProvider`。恢复快照和缩略图属于应用内部数据，由各自基础设施服务写入 Electron `userData`。

## 编辑器适配

`ExcalidrawAdapter` 隔离 Excalidraw API：

- 标准文件转换为 `initialData`
- Scene 转换为标准 Excalidraw JSON
- 获取 BinaryFiles
- 生成 PNG 缩略图
- 导出 PNG 和 SVG

页面不负责拼装文件格式，也不 Fork Excalidraw。

## 页面

- `WelcomePage`：首次选择或修复工作区
- `WorkspacePage`：索引、搜索和文件管理
- `EditorPage`：Excalidraw 和保存生命周期
- `SettingsPage`：主题和工作区切换
