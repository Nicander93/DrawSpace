# 桌面画布工作区 PRD

**产品暂名：CanvasDesk**
**版本：PRD v1.0**
**目标版本：V0 本地工作区**
**产品形态：Windows 优先的桌面应用，后续支持 macOS、Linux**

---

## 1. 产品概述

CanvasDesk 是一个基于 Excalidraw 的本地优先桌面画布管理工具。

应用打开后不是直接进入空白画布，而是进入类似 Google Drive、Notion 工作区的文件管理首页。用户可以在工作区中创建、查看、搜索、收藏和管理多个 Excalidraw 画布，并选择将文件保存在：

1. 普通本地目录；
2. 坚果云等第三方同步盘的本地同步目录；
3. 阿里云 OSS；
4. MinIO 或其他 S3 兼容对象存储。

CanvasDesk 不重新实现绘图引擎，而是嵌入 Excalidraw 编辑器，在其基础上提供工作区管理、可靠保存、文件索引、多存储接入和版本管理能力。

---

## 2. 产品定位

### 2.1 核心定位

> 一个本地优先、开放文件格式、支持多存储后端的桌面画布工作区。

### 2.2 核心价值

现有 Excalidraw 更接近“打开即画”的编辑工具，但当用户长期使用后，会逐渐遇到以下问题：

* 画布文件数量增加后难以管理；
* 不容易找到最近使用的画布；
* 缺少统一缩略图预览；
* 文件散落在不同目录；
* 本地文件和云端文件缺少统一入口；
* 自动保存、崩溃恢复和同步状态不够明确；
* 自托管用户希望使用 OSS 或 MinIO 保存数据；
* 用户不希望被绑定到厂商私有云。

CanvasDesk 负责解决这些画布之外的问题。

### 2.3 产品原则

1. **本地优先**：网络不可用时仍可创建、编辑和保存画布。
2. **用户拥有文件**：文件始终可以被用户直接访问、复制和备份。
3. **开放格式**：优先使用标准 `.excalidraw` 文件。
4. **不绑定云服务**：不强制用户注册账号或上传到官方服务器。
5. **存储适配器化**：本地、WebDAV、OSS、MinIO 使用统一抽象。
6. **保存可靠性优先**：宁可生成冲突副本，也不静默覆盖用户数据。
7. **不修改核心编辑体验**：尽量保持原生 Excalidraw 的交互方式。

---

## 3. 目标用户

### 3.1 核心用户

* 经常使用 Excalidraw 绘制架构图、流程图和草图的开发者；
* 使用多个画布管理项目和知识的个人用户；
* 希望文件保存在本地或私有云的用户；
* 使用坚果云、NAS、OSS、MinIO 的技术用户；
* 对数据隐私和文件可迁移性有要求的用户。

### 3.2 典型使用场景

#### 场景一：本地画布管理

用户打开应用，在工作区首页看到最近打开的画布缩略图，点击后进入编辑页面。修改完成后自动保存到本地目录。

#### 场景二：坚果云跨设备同步

用户将工作区设置为坚果云的本地同步目录。CanvasDesk 负责读写普通文件，坚果云客户端负责跨设备同步。

#### 场景三：私有对象存储

用户配置自己的 MinIO 服务，CanvasDesk 将画布同步到指定 Bucket 和目录前缀中。

#### 场景四：阿里云 OSS

用户配置 OSS Endpoint、Bucket 和访问凭证，将画布保存到自己的 OSS 空间中。

#### 场景五：异常恢复

应用或系统意外退出。再次启动后，CanvasDesk 检测到未正常保存的恢复快照，并提示用户恢复。

---

## 4. 版本规划

## 4.1 V0：本地工作区

V0 用于验证产品核心体验。

必须完成：

* 工作区首页；
* 创建画布；
* 打开画布；
* 自动保存；
* 最近打开；
* 收藏；
* 搜索；
* 缩略图；
* 重命名；
* 移动；
* 删除和回收站；
* `.excalidraw` 文件导入；
* `.excalidraw` 文件导出；
* 崩溃恢复；
* 外部文件修改检测；
* 支持选择任意本地文件夹作为工作区；
* 支持选择坚果云本地同步目录作为工作区；
* Windows 安装包。

V0 不实现：

* WebDAV 直连；
* OSS；
* MinIO；
* 实时多人协作；
* 用户账号；
* 团队空间；
* 在线分享；
* 评论；
* AI 功能；
* 自动合并两个冲突画布；
* 移动端应用。

---

## 4.2 V1：S3 兼容存储

增加：

* 阿里云 OSS；
* MinIO；
* 通用 S3 兼容存储；
* 本地缓存；
* 后台同步；
* 同步队列；
* 冲突副本；
* 手动同步；
* 离线编辑；
* 存储连接测试；
* 凭证安全存储；
* 同步状态中心。

---

## 4.3 V2：高级文档管理

增加：

* WebDAV 直连；
* 画布标签；
* 历史版本；
* 模板中心；
* 画布内部链接；
* 全局内容搜索；
* 文件夹批量操作；
* 存储迁移；
* 画布资源拆分；
* 只读分享。

---

## 5. V0 信息架构

应用主要包含两个页面：

```text
WorkspacePage
└── 工作区文件管理页面

EditorPage
└── Excalidraw 画布编辑页面
```

### 5.1 工作区页面

左侧导航：

```text
首页
最近打开
收藏
我的画布
回收站

工作区
  本地工作区名称

设置
```

主区域：

* 页面标题；
* 创建画布按钮；
* 导入画布按钮；
* 搜索框；
* 排序按钮；
* 卡片视图和列表视图切换；
* 画布列表；
* 空状态；
* 错误状态；
* 扫描状态。

### 5.2 编辑页面

顶部增加桌面工作区工具栏：

```text
返回工作区
画布名称
文件位置
保存状态
收藏
导出
更多
```

下方嵌入 Excalidraw。

不要修改 Excalidraw 的核心绘图工具栏，除非某项功能无法通过公开 API 实现。

---

## 6. 用户流程

## 6.1 首次启动

1. 用户打开应用。
2. 应用显示欢迎页面。
3. 用户选择：

   * 创建新的本地工作区；
   * 打开已有文件夹；
   * 选择坚果云同步目录。
4. 用户选择目录。
5. 应用扫描目录中的 `.excalidraw` 文件。
6. 应用生成文件索引和缩略图。
7. 进入工作区首页。

首次启动时不要求注册账号。

---

## 6.2 创建画布

1. 用户点击“新建画布”。
2. 系统创建默认名称，例如：

```text
未命名画布 2026-07-27 1630
```

3. 系统立即生成对应 `.excalidraw` 文件。
4. 进入编辑页面。
5. 用户开始绘制。
6. 系统自动保存。
7. 用户返回工作区后看到缩略图和更新时间。

文件名冲突时自动追加数字：

```text
未命名画布.excalidraw
未命名画布 2.excalidraw
未命名画布 3.excalidraw
```

---

## 6.3 打开画布

1. 用户在工作区点击画布卡片。
2. 应用读取文件内容。
3. 校验 JSON 结构。
4. 将数据传给 Excalidraw。
5. 更新 `lastOpenedAt`。
6. 将该画布加入最近打开列表。

如果文件损坏：

* 不得直接覆盖原文件；
* 显示错误原因；
* 支持打开文件所在目录；
* 支持尝试从恢复快照打开。

---

## 6.4 自动保存

用户修改画布后：

1. Excalidraw `onChange` 返回新状态。
2. Renderer 更新内存状态。
3. 经过防抖后发送保存请求。
4. Main Process 将内容写入临时文件。
5. 临时文件写入成功后替换正式文件。
6. 更新 SQLite 索引。
7. 异步生成缩略图。
8. UI 更新为“已保存”。

推荐状态：

```text
saved
saving
dirty
error
conflict
recoverable
```

推荐保存策略：

* 用户操作期间只更新内存状态；
* 停止操作约 800 毫秒后保存本地文件；
* 窗口失焦时立即保存；
* 返回工作区前立即保存；
* 关闭窗口前尝试完成最后一次保存；
* 长时间持续绘制时，每 10 秒至少保存一次恢复快照。

禁止直接对正式文件执行非原子写入。

推荐流程：

```text
document.excalidraw
document.excalidraw.tmp
```

先写入 `.tmp`，写入和同步磁盘成功后，再替换正式文件。

---

## 6.5 外部修改检测

工作区可能位于坚果云、OneDrive 或其他同步目录，因此文件可能被外部程序修改。

打开画布时记录：

```text
mtime
fileSize
contentHash
```

保存前再次检查文件状态。

如果文件已被外部修改：

1. 停止覆盖原文件；
2. 将当前内容保存为冲突副本；
3. 显示冲突提示；
4. 允许用户分别打开本地版本和外部版本。

冲突副本命名：

```text
系统架构图 (冲突副本 2026-07-27 163000).excalidraw
```

V0 不进行元素级自动合并。

---

## 6.6 删除和回收站

删除画布时不立即永久删除。

移动到工作区内部回收站目录：

```text
.canvasdesk/
  trash/
```

回收站记录：

* 原始路径；
* 删除时间；
* 文件名称；
* 文档 ID。

用户可以：

* 恢复；
* 永久删除；
* 清空回收站。

恢复时原路径存在同名文件，应提示重命名或覆盖。

---

## 7. 功能需求

## 7.1 工作区管理

### FR-001 创建工作区

用户可以选择一个本地文件夹作为工作区。

验收标准：

* 可以创建空文件夹；
* 可以选择已有文件夹；
* 应用记住最近打开的工作区；
* 工作区路径失效时显示修复入口；
* 不允许在未授权情况下访问其他目录。

### FR-002 切换工作区

V0 可以在设置页面切换工作区。

切换前必须：

* 保存当前画布；
* 停止旧工作区文件监听；
* 清理内存索引；
* 初始化新工作区；
* 扫描新工作区文件。

### FR-003 工作区扫描

扫描范围：

* 工作区根目录；
* 所有子目录；
* 扩展名为 `.excalidraw` 的文件。

必须排除：

```text
.canvasdesk/
node_modules/
.git/
系统隐藏目录
```

扫描过程不得阻塞 UI。

---

## 7.2 画布管理

### FR-010 新建画布

必须支持：

* 在根目录创建；
* 在指定文件夹创建；
* 自动生成名称；
* 创建后立即打开。

### FR-011 重命名

重命名同时修改：

* 实际文件名；
* SQLite 索引；
* 最近打开记录；
* 缩略图关联；
* 回到工作区后的显示名称。

不直接修改 Excalidraw 内容中的画布数据。

### FR-012 移动画布

支持移动到工作区中的其他文件夹。

V0 仅允许工作区内部移动。

### FR-013 复制画布

复制后生成新的文件和文档记录。

默认命名：

```text
原文件名 副本.excalidraw
```

### FR-014 收藏

收藏状态保存在本地 SQLite 中。

收藏不需要修改 `.excalidraw` 文件。

### FR-015 最近打开

默认显示最近打开的 20 个画布。

排序依据：

```text
lastOpenedAt DESC
```

### FR-016 搜索

V0 搜索范围：

* 文件名；
* 相对路径。

搜索必须使用本地索引，不得每次重新扫描磁盘。

### FR-017 排序

支持：

* 最近打开；
* 最近修改；
* 名称升序；
* 名称降序；
* 创建时间。

---

## 7.3 缩略图

每个画布生成一张 WebP 或 PNG 缩略图。

推荐规格：

```text
宽度：480 px
高度：270 px
格式：WebP
保持画布比例
背景使用画布背景色
```

缩略图保存位置：

```text
应用用户数据目录/
  thumbnails/
    <documentId>.webp
```

不要默认将缩略图放在用户工作区内，避免污染用户目录。

重新生成条件：

* 文件内容发生变化；
* 缩略图不存在；
* 缩略图生成版本发生变化；
* 用户主动刷新。

缩略图生成失败不得影响画布保存。

---

## 7.4 导入与导出

### FR-030 导入

支持：

* 选择一个 `.excalidraw` 文件；
* 拖拽文件到工作区；
* 复制文件到当前工作区；
* 文件名冲突处理。

导入前必须验证：

* 文件存在；
* JSON 可解析；
* 包含合法的 Excalidraw 数据结构；
* 文件大小未超过配置限制。

### FR-031 导出

支持：

* 导出标准 `.excalidraw`；
* 导出 PNG；
* 导出 SVG。

图片导出优先调用 Excalidraw 官方提供的导出能力。

V0 不实现 PDF 导出。

---

## 7.5 崩溃恢复

恢复快照保存在：

```text
应用用户数据目录/
  recovery/
    <documentId>.json
```

快照必须包含：

```ts
interface RecoverySnapshot {
  documentId: string;
  sourcePath: string;
  savedAt: number;
  sourceModifiedAt: number;
  sceneData: unknown;
}
```

应用启动时检测恢复快照。

满足以下条件时显示恢复提示：

* 快照时间晚于正式文件修改时间；
* 上次编辑会话未正常结束；
* 快照数据可正常解析。

用户可以：

* 恢复；
* 查看；
* 忽略；
* 删除恢复快照。

恢复操作默认生成副本，不静默覆盖原文件。

---

## 8. 文件格式

## 8.1 V0 文件策略

V0 使用标准 `.excalidraw` 文件。

禁止创建无法被标准 Excalidraw 打开的私有主文件格式。

应用自身数据不得强制写入 Excalidraw Scene JSON。

应用元数据存储在 SQLite 中。

---

## 8.2 工作区内部目录

工作区允许创建一个内部管理目录：

```text
<workspace>/
  .canvasdesk/
    workspace.json
    trash/
```

`workspace.json` 示例：

```json
{
  "version": 1,
  "workspaceId": "uuid",
  "name": "My Workspace",
  "createdAt": "2026-07-27T08:00:00.000Z"
}
```

SQLite、缩略图、恢复快照和凭证不得放在工作区中。

---

## 9. 本地数据库设计

使用 SQLite。

数据库位置：

```text
Electron userData/
  canvasdesk.db
```

## 9.1 workspaces

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  root_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);
```

## 9.2 documents

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  extension TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  modified_at INTEGER,
  indexed_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  thumbnail_path TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local',
  UNIQUE(workspace_id, relative_path)
);
```

## 9.3 trash_records

```sql
CREATE TABLE trash_records (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  original_relative_path TEXT NOT NULL,
  trash_relative_path TEXT NOT NULL,
  deleted_at INTEGER NOT NULL
);
```

## 9.4 app_sessions

```sql
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  exit_status TEXT NOT NULL
);
```

---

## 10. 存储抽象

虽然 V0 只实现本地存储，但代码必须从第一天使用统一存储接口，避免后续重构整个业务层。

```ts
export interface StorageProvider {
  readonly type: string;

  initialize(): Promise<void>;

  list(
    path: string,
    options?: {
      recursive?: boolean;
      cursor?: string;
      limit?: number;
    }
  ): Promise<{
    entries: StorageEntry[];
    nextCursor?: string;
  }>;

  read(path: string): Promise<Uint8Array>;

  write(
    path: string,
    data: Uint8Array,
    options?: {
      expectedVersion?: string;
      contentType?: string;
    }
  ): Promise<StorageWriteResult>;

  stat(path: string): Promise<StorageEntry | null>;

  exists(path: string): Promise<boolean>;

  move(sourcePath: string, targetPath: string): Promise<void>;

  copy(sourcePath: string, targetPath: string): Promise<void>;

  delete(path: string): Promise<void>;

  createDirectory(path: string): Promise<void>;

  watch?(
    path: string,
    listener: (event: StorageWatchEvent) => void
  ): Promise<() => void>;
}
```

相关类型：

```ts
export interface StorageEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: number;
  version?: string;
  etag?: string;
}

export interface StorageWriteResult {
  version?: string;
  etag?: string;
  modifiedAt?: number;
}

export interface StorageWatchEvent {
  type: "created" | "updated" | "deleted" | "renamed";
  path: string;
  oldPath?: string;
}
```

V0 实现：

```text
LocalStorageProvider
```

V1 实现：

```text
S3StorageProvider
```

V2 实现：

```text
WebDavStorageProvider
```

业务层禁止直接调用 Node.js `fs`。

所有文件操作必须通过 `StorageProvider` 或其上层 `DocumentService` 完成。

---

## 11. 应用架构

## 11.1 技术栈

建议使用：

```text
Electron
React
TypeScript
Vite
@excalidraw/excalidraw
SQLite
Zustand
Zod
```

可选：

```text
TanStack Query
React Router
electron-builder
chokidar
better-sqlite3
keytar
```

最终依赖应根据兼容性选择，不强制使用上述具体库。

---

## 11.2 Electron 进程职责

### Renderer Process

负责：

* React UI；
* 工作区页面；
* Excalidraw 编辑器；
* 用户交互；
* 临时编辑状态；
* 保存状态展示；
* 缩略图导出数据；
* 调用安全 IPC。

### Main Process

负责：

* 文件系统；
* SQLite；
* 工作区扫描；
* 原子写入；
* 文件监听；
* 恢复快照；
* 系统文件选择器；
* 应用窗口；
* 安全凭证；
* 后续云端同步。

### Preload

只暴露白名单 API。

禁止 Renderer 直接访问：

```text
fs
path
child_process
process.env
Node.js 全局对象
```

建议 API：

```ts
window.desktopApi.workspace.open();
window.desktopApi.workspace.scan();
window.desktopApi.documents.list();
window.desktopApi.documents.read();
window.desktopApi.documents.save();
window.desktopApi.documents.rename();
window.desktopApi.documents.move();
window.desktopApi.documents.delete();
window.desktopApi.documents.restore();
window.desktopApi.recovery.list();
```

必须开启：

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
```

---

## 11.3 推荐目录结构

```text
src/
  main/
    index.ts
    windows/
    ipc/
    database/
    services/
      WorkspaceService.ts
      DocumentService.ts
      ThumbnailService.ts
      RecoveryService.ts
      FileWatchService.ts
    storage/
      StorageProvider.ts
      LocalStorageProvider.ts

  preload/
    index.ts
    api.ts

  renderer/
    app/
    pages/
      WorkspacePage/
      EditorPage/
      SettingsPage/
      TrashPage/
    components/
      DocumentCard/
      DocumentList/
      WorkspaceSidebar/
      SaveStatus/
      EmptyState/
    features/
      workspace/
      documents/
      editor/
      recovery/
    stores/
    hooks/

  shared/
    schemas/
    types/
    constants/
    errors/
```

---

## 12. 编辑器适配层

不要在页面组件中直接大量调用 Excalidraw API。

创建独立适配层：

```text
ExcalidrawAdapter
```

职责：

* 标准文件到 Excalidraw 初始数据转换；
* Excalidraw 状态到文件数据转换；
* 导出 PNG；
* 导出 SVG；
* 生成缩略图；
* 清理不应持久化的临时状态；
* 统一处理 BinaryFiles。

接口示例：

```ts
export interface CanvasAdapter {
  parse(data: Uint8Array): Promise<CanvasDocument>;
  serialize(document: CanvasDocument): Promise<Uint8Array>;
  createEmpty(): CanvasDocument;
  renderThumbnail(document: CanvasDocument): Promise<Blob>;
  exportPng(document: CanvasDocument): Promise<Blob>;
  exportSvg(document: CanvasDocument): Promise<string>;
}
```

不要 Fork 整个 Excalidraw 仓库。

只有在公开组件 API 无法满足关键需求时，才评估维护 Fork。

---

## 13. 页面设计要求

## 13.1 工作区首页

视觉方向：

* 简洁；
* 中性；
* 接近现代桌面文件管理器；
* 不模仿 Windows Explorer；
* 不复制 Google Drive 品牌样式；
* 强调缩略图；
* 支持浅色和深色主题。

卡片内容：

```text
缩略图
画布名称
相对路径
修改时间
收藏状态
保存或同步状态
更多菜单
```

卡片操作：

* 单击选中；
* 双击打开；
* 右键菜单；
* 支持键盘 Enter 打开；
* Delete 移入回收站；
* F2 重命名。

右键菜单：

```text
打开
重命名
复制
移动
收藏/取消收藏
在文件管理器中显示
导出
移入回收站
```

---

## 13.2 编辑页面

顶部栏必须显示保存状态。

状态文案：

```text
未保存
正在保存
已保存
保存失败
检测到外部修改
```

保存失败时：

* 不隐藏错误；
* 提供重试按钮；
* 保留内存数据；
* 生成恢复快照；
* 不允许用户误以为已经保存成功。

---

## 13.3 空状态

首次进入空工作区时显示：

```text
这里还没有画布

创建你的第一个画布，或者导入已有的 .excalidraw 文件。
```

操作按钮：

```text
新建画布
导入文件
```

---

## 14. 快捷键

V0 建议支持：

```text
Ctrl + N        新建画布
Ctrl + O        导入或打开文件
Ctrl + S        立即保存
Ctrl + Shift + S 另存为
Ctrl + F        搜索画布
Ctrl + W        关闭当前画布并返回工作区
F2              重命名
Delete          移入回收站
Escape          取消选择或关闭弹窗
```

编辑页面内，不能覆盖 Excalidraw 已有的重要快捷键。

快捷键必须经过统一注册层管理，不允许分散在不同页面中硬编码。

---

## 15. 非功能需求

## 15.1 性能

在普通 SSD Windows 设备上：

* 应用冷启动到显示工作区：首页小于 3 秒；
* 已建立索引后，展示 1000 个画布：首页小于 1 秒；
* 打开普通画布：小于 2 秒；
* 搜索响应：小于 200 毫秒；
* 自动保存不得明显阻塞绘制；
* 工作区扫描必须在后台进行；
* 缩略图生成不得阻塞主线程。

文件数量较多时必须使用虚拟列表或分页渲染。

---

## 15.2 可靠性

必须保证：

* 保存过程中崩溃不破坏原文件；
* 保存失败时保留恢复快照；
* 外部修改时不静默覆盖；
* 文件读取错误不会导致应用整体崩溃；
* SQLite 损坏不影响原始 `.excalidraw` 文件；
* 用户可以通过文件管理器直接访问画布；
* 卸载应用不会删除用户工作区文件。

---

## 15.3 安全

* Electron 禁止启用 Node Integration；
* 所有 IPC 参数使用 Zod 或同类方案校验；
* 文件路径必须验证位于当前工作区内；
* 防止 `../` 路径穿越；
* 不执行画布文件中的脚本；
* 外部链接打开前进行协议校验；
* 禁止 Renderer 直接读取系统凭证；
* 日志中不得记录 AccessKey、Secret、密码或完整 Token。

---

## 15.4 隐私

V0 默认不收集用户画布内容。

如后续增加遥测，只允许收集：

* 应用版本；
* 启动成功或失败；
* 功能使用次数；
* 非敏感错误码；
* 性能指标。

不得上传：

* 文件名；
* 文件路径；
* 画布内容；
* 图片；
* 存储账号；
* 用户访问凭证。

遥测必须提供关闭选项。

---

## 16. V1 S3、OSS 和 MinIO 设计约束

V1 使用统一 `S3StorageProvider`。

配置项：

```ts
interface S3StorageConfig {
  id: string;
  name: string;
  endpoint?: string;
  region: string;
  bucket: string;
  prefix?: string;
  forcePathStyle?: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}
```

阿里云 OSS 和 MinIO 作为预设类型：

```text
Aliyun OSS
MinIO
Generic S3
```

但底层尽量复用同一套基础逻辑。

必须支持：

* ListObjects；
* GetObject；
* PutObject；
* HeadObject；
* DeleteObject；
* CopyObject；
* 分页；
* ETag；
* 前缀目录；
* 网络超时；
* 重试；
* 取消请求。

不得依赖：

* 服务端真实目录；
* 对象重命名原子操作；
* 所有厂商完全一致的高级 S3 特性。

远程重命名通过：

```text
CopyObject
DeleteObject
```

实现。

批量移动目录必须显示进度，并允许失败后恢复。

---

## 17. V1 同步模型

每个远程画布在本地保存缓存。

```text
远程存储
    ↕
同步服务
    ↕
本地缓存
    ↕
编辑器
```

编辑器永远优先读写本地缓存，不直接等待远程请求。

同步状态：

```text
local_only
synced
pending_upload
pending_download
uploading
downloading
conflict
error
offline
```

保存流程：

1. 编辑器保存到本地缓存；
2. 更新 SQLite；
3. 将上传任务加入同步队列；
4. 后台上传；
5. 校验远程 ETag；
6. 上传成功后更新状态；
7. 失败后按策略重试。

冲突条件：

* 本地有未上传修改；
* 远程 ETag 与上次记录不同。

冲突处理：

* 下载远程版本；
* 保留本地版本；
* 生成两个可独立打开的文件；
* 用户决定保留哪一个。

不得使用“最后写入者获胜”作为默认策略。

---

## 18. 错误处理

统一定义业务错误：

```ts
type AppErrorCode =
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_PERMISSION_DENIED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_INVALID"
  | "DOCUMENT_SAVE_FAILED"
  | "DOCUMENT_CONFLICT"
  | "DATABASE_ERROR"
  | "THUMBNAIL_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_AUTH_FAILED"
  | "STORAGE_RATE_LIMITED";
```

错误对象：

```ts
interface AppError {
  code: AppErrorCode;
  message: string;
  recoverable: boolean;
  details?: unknown;
}
```

UI 不直接显示原始堆栈。

日志中保留技术信息，界面显示用户可理解的描述。

---

## 19. 日志

建议使用结构化日志。

日志级别：

```text
debug
info
warn
error
```

必须记录：

* 应用启动；
* 工作区打开；
* 扫描开始和结束；
* 文件打开；
* 保存成功和失败；
* 文件冲突；
* 恢复快照；
* 数据库迁移；
* 未捕获异常。

不得记录画布正文。

日志文件应支持自动轮转。

---

## 20. 测试要求

## 20.1 单元测试

必须覆盖：

* 路径合法性；
* 文件名冲突；
* 文档序列化；
* 原子保存；
* 恢复快照判断；
* 工作区扫描过滤；
* SQLite Repository；
* StorageProvider；
* 冲突检测；
* 错误转换。

## 20.2 集成测试

必须覆盖：

* 创建工作区；
* 扫描已有画布；
* 创建和保存画布；
* 重命名；
* 移动；
* 删除和恢复；
* 导入；
* 导出；
* 外部修改；
* 非正常退出恢复；
* SQLite 重建索引。

## 20.3 E2E 测试

至少覆盖：

1. 首次启动并创建工作区；
2. 创建画布并绘制内容；
3. 关闭应用后重新打开；
4. 画布内容仍然存在；
5. 修改画布并自动保存；
6. 删除后从回收站恢复；
7. 导入已有 `.excalidraw` 文件；
8. 外部修改文件后应用显示冲突提示。

---

## 21. V0 验收标准

满足以下条件，V0 才可视为完成。

### 工作区

* 可以选择任意本地目录；
* 可以扫描子目录中的 `.excalidraw` 文件；
* 可以记住上次工作区；
* 工作区路径失效时不会白屏。

### 文件管理

* 可以创建、打开、重命名、移动、复制和删除画布；
* 可以收藏；
* 可以搜索；
* 可以查看最近打开；
* 可以从回收站恢复；
* 可以在系统文件管理器中显示文件。

### 编辑

* Excalidraw 核心功能可正常使用；
* 图片插入后可保存和重新打开；
* 自动保存状态可见；
* 手动保存可用；
* 返回工作区前完成保存。

### 数据可靠性

* 保存采用临时文件和替换机制；
* 应用崩溃后可以恢复；
* 外部修改时不直接覆盖；
* SQLite 删除后可以重新扫描恢复索引；
* 原始画布文件不依赖 SQLite 才能打开。

### 桌面体验

* 支持浅色和深色主题；
* 支持基础快捷键；
* 支持拖拽导入；
* 支持 Windows 安装和卸载；
* 卸载应用不会删除工作区文件。

---

## 22. 实施阶段

## 阶段一：工程初始化

任务：

* 创建 Electron、React、TypeScript 工程；
* 配置 Main、Preload、Renderer；
* 配置开发模式和生产构建；
* 配置基础路由；
* 配置 ESLint、格式化和测试；
* 实现安全 IPC 基础层。

交付物：

* 应用可启动；
* 可在 WorkspacePage 和 EditorPage 之间切换；
* Windows 开发环境可运行。

---

## 阶段二：本地存储和数据库

任务：

* 实现 `StorageProvider`；
* 实现 `LocalStorageProvider`；
* 初始化 SQLite；
* 实现 WorkspaceRepository；
* 实现 DocumentRepository；
* 实现工作区选择；
* 实现后台扫描；
* 实现本地文件监听。

交付物：

* 可选择工作区；
* 可扫描并展示 `.excalidraw` 文件；
* 重启后索引仍然存在。

---

## 阶段三：工作区 UI

任务：

* 左侧导航；
* 卡片列表；
* 列表视图；
* 最近打开；
* 收藏；
* 搜索；
* 排序；
* 空状态；
* 错误状态；
* 加载状态；
* 右键菜单。

交付物：

* 用户可以在不进入编辑器的情况下完成基本文件管理。

---

## 阶段四：Excalidraw 集成

任务：

* 安装并嵌入 Excalidraw；
* 实现 `ExcalidrawAdapter`；
* 创建空白画布；
* 打开现有画布；
* 保存 Scene 数据；
* 保存 BinaryFiles；
* PNG、SVG 导出；
* 页面切换时保持数据正确。

交付物：

* 标准 Excalidraw 文件可以正常编辑和重新打开。

---

## 阶段五：可靠保存

任务：

* 防抖保存；
* 原子写入；
* 保存状态；
* 恢复快照；
* 会话异常检测；
* 外部修改检测；
* 冲突副本；
* 保存失败重试。

交付物：

* 模拟崩溃和磁盘写入失败时，用户数据不被静默丢失。

---

## 阶段六：缩略图和回收站

任务：

* 异步生成缩略图；
* 缩略图缓存；
* 删除到回收站；
* 恢复；
* 永久删除；
* 清空回收站。

交付物：

* 工作区形成完整的画布管理体验。

---

## 阶段七：打包和验收

任务：

* Windows 安装包；
* 应用图标；
* 自动更新能力预留；
* 崩溃日志；
* E2E 测试；
* 性能测试；
* 大工作区测试；
* 文档编写。

交付物：

* 可安装、可卸载的 Windows 测试版本；
* 测试报告；
* 已知问题列表。

---

## 23. Coding Agent 执行约束

执行本 PRD 时遵循以下要求：

1. 先实现 V0，不提前实现云同步。
2. 不 Fork Excalidraw。
3. 不重新实现绘图引擎。
4. 不将业务逻辑直接写入 React 页面组件。
5. 不允许 Renderer 直接访问文件系统。
6. 不允许业务层直接依赖 Node.js `fs`。
7. 所有文件操作通过 `StorageProvider`。
8. 所有 IPC 参数必须校验。
9. 保存必须使用原子写入。
10. 外部文件变化时不得静默覆盖。
11. SQLite 只作为索引，不作为画布内容唯一存储。
12. 应用卸载后用户文件必须保持可用。
13. 每个开发阶段完成后补充测试。
14. 不在未完成 V0 验收前增加账号、团队或多人协作功能。
15. 任何私有扩展都不能破坏标准 `.excalidraw` 文件兼容性。

---

## 24. 最终交付物

Coding Agent 最终应交付：

```text
1. 完整源代码
2. README
3. 开发环境启动说明
4. Windows 构建说明
5. 架构说明
6. StorageProvider 接口说明
7. SQLite 数据库说明
8. 自动保存和恢复机制说明
9. 测试用例
10. Windows 安装包
11. 已知问题列表
12. V1 S3 存储扩展建议
```

README 至少包含：

```text
项目介绍
功能截图
技术栈
项目结构
开发环境
安装依赖
启动命令
构建命令
测试命令
数据存储位置
工作区文件格式
隐私说明
许可证说明
```

---

## 25. 完成定义

当用户能够完成以下完整流程时，V0 才算真正完成：

1. 安装并启动 CanvasDesk；
2. 选择一个本地或坚果云同步目录；
3. 在工作区中新建画布；
4. 使用 Excalidraw 完成绘制；
5. 自动保存；
6. 返回工作区并看到缩略图；
7. 关闭应用；
8. 再次打开应用；
9. 从最近打开中进入该画布；
10. 内容完整保留；
11. 即使应用异常退出，也能够通过恢复快照找回修改；
12. 用户可以使用原版 Excalidraw 打开生成的文件。

该流程是 V0 的核心验收主线，其他功能不得破坏该流程。
