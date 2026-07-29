# CanvasDesk 工作区交互与多画布 Tab 改造执行方案

## 1. 文档目的

基于当前仓库：

```text
Nicander93/my-excaildraw-local

```

优化 CanvasDesk 的工作区和编辑器交互，重点解决：

1. 工作区中的重命名、收藏、移动、删除等操作不够直观。
2. 当前只能编辑一个画布，无法同时打开多个画布。
3. 无法形成稳定的“画布 A 复制元素，切换到画布 B 粘贴”工作流。
4. 当前编辑器的保存状态、session、恢复快照都绑定在单个 `EditorPage` 实例中，不支持多文档。
5. 关闭标签、切换工作区和退出程序时，缺少统一的多文档未保存处理机制。

本次改造必须优先保证：

- 不破坏标准 `.excalidraw` 文件格式。
- 不降低现有原子保存、外部修改检测、冲突副本和恢复快照的可靠性。
- 不重复实现当前已经存在的文档操作 API。
- 不为了多标签功能重写 Main 进程的存储架构。
- 每个阶段均可独立运行、测试和回滚。

---

# 2. 当前代码现状

## 2.1 工作区

当前 `WorkspacePage.tsx` 已经支持：

- 打开画布。
- 重命名。
- 创建副本。
- 移动到指定目录。
- 收藏和取消收藏。
- 在文件管理器中显示。
- 导出。
- 移入回收站。
- 恢复和永久删除。
- `F2` 重命名。
- `Delete` 移入回收站。

相关操作主要由以下文件承载：

```text
src/renderer/src/pages/WorkspacePage.tsx
src/renderer/src/components/DocumentCard.tsx
src/renderer/src/components/DocumentList.tsx
src/renderer/src/components/DocumentContextMenu.tsx
src/renderer/src/stores/workspaceStore.ts

```

当前问题不是底层能力缺失，而是：

1. 大部分操作依赖右键菜单或“更多”菜单。
2. 收藏缺少明显的直接操作入口。
3. 移动画布时要求用户手动输入目录路径，缺少文件夹选择器。
4. 工作区目前只保存一个 `selectedDocumentId`，不支持多选。
5. 卡片、列表和快捷键的操作入口没有统一抽象。

## 2.2 编辑器

当前路由结构是：

```tsx
<Route path="/editor/:documentId" element={<EditorPage />} />

```

`EditorPage.tsx` 内部直接保存：

- 当前 `DocumentContent`。
- 当前 `CanvasDocument`。
- 当前保存状态。
- 当前 scene。
- 当前 Excalidraw runtime。
- 当前 version。
- 当前 sessionId。
- 当前 dirty 状态。
- 当前 revision。
- 当前保存 Promise。
- 当前自动保存计时器。

这是一套明确的单文档模型，不能通过简单增加标签栏直接升级为多文档。

当前 `Ctrl+W` 的行为是：

1. 强制保存当前画布。
2. 关闭当前 session。
3. 返回工作区。

改造后应变为“关闭当前标签”。

---

# 3. 本次改造范围

## 3.1 必须完成

### 工作区

- 卡片和列表直接提供收藏入口。
- 卡片悬停时提供快捷操作。
- 统一卡片、列表和右键菜单操作。
- 将“移动到”从文本路径输入改为文件夹选择器。
- 保留现有 `F2` 和 `Delete` 快捷键。
- 为后续多选预留状态模型。

### 编辑器

- 支持同时打开多个画布。
- 顶部显示画布标签栏。
- 标签可切换、关闭和重新排序。
- 同一画布不能重复打开多个实例。
- 每个标签独立维护保存状态和 session。
- 支持通过 `Ctrl+Tab` 切换标签。
- 支持通过 `Ctrl+W` 关闭当前标签。
- 支持画布 A 中 `Ctrl+C`，切换到画布 B 后 `Ctrl+V`。
- 关闭未保存标签时进行确认。
- 退出应用时统一处理所有未保存标签。
- 外部修改冲突只影响对应标签。

## 3.2 本轮暂不实现

- 标签左右分屏。
- 多窗口编辑。
- 标签分组。
- 云端协作。
- OSS、MinIO、WebDAV。
- 跨设备同步标签状态。
- 复杂的版本历史。
- 自定义 Excalidraw 元素序列化协议。
- 重写 Excalidraw 原生复制粘贴逻辑。

---

# 4. 目标交互设计

# 4.1 工作区画布卡片

## 4.1.1 单击和双击

保持当前行为：

- 单击：选中画布。
- 双击：打开画布。
- `Enter`：打开当前选中的画布。
- `F2`：重命名。
- `Delete`：移入回收站。
- `Escape`：取消选择或关闭菜单。

## 4.1.2 卡片快捷操作

画布卡片右上角增加以下快捷入口：

```text
[收藏] [更多]

```

交互规则：

- 收藏按钮始终可以点击。
- 未收藏时显示空心星标。
- 已收藏时显示实心星标。
- 点击收藏不能触发卡片选中或打开。
- “更多”打开现有上下文菜单。
- 卡片被选中或鼠标悬停时显示快捷按钮。
- 触屏或键盘聚焦时也必须可见，不能只依赖 `hover`。

建议修改 `DocumentCardProps`：

```ts
interface DocumentCardProps {
  document: CanvasDocument;
  selected: boolean;
  onSelect(): void;
  onOpen(): void;
  onToggleFavorite(): void;
  onContextMenu(event: React.MouseEvent): void;
}

```

收藏按钮事件必须调用：

```ts
event.preventDefault();
event.stopPropagation();

```

## 4.1.3 列表视图

`DocumentList` 与卡片视图保持一致：

- 提供收藏按钮。
- 提供更多按钮。
- 双击行打开。
- 单击行选中。
- 不允许列表视图和卡片视图出现不同的操作集合。

建议提取统一组件：

```text
src/renderer/src/components/DocumentQuickActions.tsx

```

负责：

- 收藏。
- 更多菜单。
- 阻止事件冒泡。
- 无障碍标签。
- tooltip。

## 4.1.4 右键菜单

继续保留当前功能：

```text
打开
重命名
创建副本
移动到
添加收藏 / 取消收藏
在文件管理器中显示
导出画布
移入回收站

```

调整菜单顺序并增加分组线：

```text
打开

重命名
创建副本
移动到

添加收藏 / 取消收藏
在文件管理器中显示
导出画布

移入回收站

```

不要删除右键菜单。快捷按钮用于高频操作，右键菜单用于完整操作。

---

# 4.2 “移动到”对话框

当前实现要求用户输入：

```text
产品设计/原型

```

该交互不直观，也容易出现路径拼写错误。

改为文件夹选择对话框。

新增：

```text
src/renderer/src/components/MoveDocumentDialog.tsx

```

界面包括：

```text
移动“画布名称”到：

○ 工作区根目录
○ 产品设计
  ○ 原型
  ○ 评审
○ 个人
○ 归档

[新建文件夹]              [取消] [移动]

```

实现方式：

1. 继续使用现有：

```ts
window.desktopApi.workspace.listDirectories()

```

2. 将返回的扁平路径：

```ts
[
  "产品设计",
  "产品设计/原型",
  "产品设计/评审",
  "归档"
]

```

转换成树形结构。

3. 根目录使用空字符串表示。
4. 用户选择目标目录后调用现有 API：

```ts
window.desktopApi.documents.move(documentId, relativeDirectory)

```

5. 支持在对话框中创建文件夹：

```ts
window.desktopApi.workspace.createDirectory(relativeDirectory)

```

6. 创建完成后刷新目录树，并自动选中新目录。
7. 如果目标目录与当前目录相同，禁用“移动”按钮。

本次不需要修改 Main 进程的移动 API。

---

# 4.3 多画布标签页

## 4.3.1 基本结构

新增编辑器工作区容器：

```text
src/renderer/src/pages/EditorWorkspacePage.tsx

```

新增标签栏：

```text
src/renderer/src/components/EditorTabs.tsx

```

将当前单文档编辑逻辑从 `EditorPage.tsx` 中提取为：

```text
src/renderer/src/features/editor/EditorDocumentPane.tsx

```

最终结构：

```text
EditorWorkspacePage
├── EditorTopbar
│   ├── 返回工作区
│   ├── EditorTabs
│   ├── 保存状态
│   ├── 收藏
│   └── 导出
└── EditorDocumentHost
    ├── EditorDocumentPane(document A)
    ├── EditorDocumentPane(document B)
    └── EditorDocumentPane(document C)

```

## 4.3.2 标签内容

每个标签显示：

```text
[状态图标] 画布名称 [关闭]

```

状态图标：

- 无图标：已保存。
- 实心圆点：未保存。
- 旋转图标：正在保存。
- 警告图标：保存失败。
- 冲突图标：检测到外部修改。

标签 tooltip 显示：

```text
画布完整名称
相对路径
保存状态

```

## 4.3.3 标签操作

支持：

- 单击：切换标签。
- 中键：关闭标签。
- 标签关闭按钮：关闭标签。
- 拖拽：调整标签顺序。
- 双击标签名称：重命名画布。
- 右键标签：
  - 关闭。
  - 关闭其他标签。
  - 关闭右侧标签。
  - 在文件管理器中显示。
  - 复制相对路径。

P0 阶段必须完成：

- 切换。
- 关闭。
- 中键关闭。
- 顺序调整。

标签右键菜单可以放入 P1。

## 4.3.4 防止重复打开

同一个 `documentId` 只能对应一个标签。

调用：

```ts
openDocument(documentId)

```

时必须先检查：

```ts
if (openDocumentIds.includes(documentId)) {
  activateDocument(documentId);
  return;
}

```

不得创建两个相同画布的 session。

## 4.3.5 新建和打开其他画布

标签栏末尾增加：

```text
[+]

```

点击后打开画布选择器。

新增：

```text
src/renderer/src/components/DocumentPicker.tsx

```

选择器支持：

- 搜索画布名称。
- 展示最近打开画布。
- 展示收藏画布。
- 点击结果后打开为新标签。
- 已经打开的画布显示“已打开”，点击后切换到现有标签。
- 支持键盘上下选择和 `Enter` 打开。
- `Escape` 关闭。

快捷键建议：

```text
Ctrl+P     打开画布选择器
Ctrl+N     新建画布并打开为标签
Ctrl+Tab   下一个标签
Ctrl+Shift+Tab 上一个标签
Ctrl+W     关闭当前标签

```

不要拦截：

```text
Ctrl+C
Ctrl+V
Ctrl+X
Ctrl+A
Ctrl+Z
Ctrl+Y

```

这些快捷键应继续交给 Excalidraw 或当前输入控件处理。

---

# 5. 多文档状态模型

新增：

```text
src/renderer/src/stores/editorStore.ts

```

建议状态：

```ts
export type EditorSaveStatus =
  | "saved"
  | "saving"
  | "dirty"
  | "error"
  | "conflict";

export interface EditorTab {
  documentId: string;
  name: string;
  relativePath: string;
  isFavorite: boolean;
  saveStatus: EditorSaveStatus;
  saveError: string | null;
  openedAt: number;
}

export interface EditorState {
  tabs: EditorTab[];
  activeDocumentId: string | null;

  openDocument(documentId: string): Promise<void>;
  createDocument(relativeDirectory?: string): Promise<void>;
  activateDocument(documentId: string): void;
  closeDocument(documentId: string): Promise<CloseResult>;
  closeOtherDocuments(documentId: string): Promise<void>;
  closeDocumentsToRight(documentId: string): Promise<void>;
  reorderTabs(fromIndex: number, toIndex: number): void;
  updateDocumentMetadata(document: CanvasDocument): void;
  updateSaveStatus(
    documentId: string,
    status: EditorSaveStatus,
    error?: string | null
  ): void;
}

```

不要将以下对象持久化到 `localStorage`：

- Excalidraw API 对象。
- DOM 引用。
- Promise。
- timer。
- AbortController。
- BinaryFiles Blob。
- React ref。

只允许持久化：

```ts
{
  openDocumentIds: string[];
  activeDocumentId: string | null;
  tabOrder: string[];
}

```

---

# 6. 每个标签的运行时状态

当前 `EditorPage.tsx` 中的以下状态必须移动到每个 `EditorDocumentPane` 内部：

```ts
documentContent
document
sceneRef
sceneRuntimeRef
versionRef
sessionIdRef
dirtyRef
revisionRef
savePromiseRef
ignoreChangesUntilRef
saveTimerRef
saveStatus
saveError

```

每个画布必须有独立的：

- 保存 Promise。
- 自动保存计时器。
- dirty 标记。
- revision。
- version。
- sessionId。
- 恢复快照。
- 保存错误。
- 冲突状态。

严禁多个标签共享：

```ts
dirtyRef
revisionRef
savePromiseRef
sessionIdRef

```

否则可能出现画布 A 的保存结果覆盖画布 B 状态的问题。

---

# 7. Excalidraw 实例生命周期

## 7.1 推荐方案

每个已经打开的标签拥有自己的 `EditorDocumentPane`。

切换标签时：

- 不卸载原标签。
- 将非激活标签设为不可见。
- 保留对应 Excalidraw 实例。
- 保留 Excalidraw 内部撤销栈、选区和视口。

建议使用叠层结构：

```tsx
<div className="editor-document-host">
  {tabs.map((tab) => (
    <div
      key={tab.documentId}
      className={
        tab.documentId === activeDocumentId
          ? "editor-document-pane is-active"
          : "editor-document-pane"
      }
      aria-hidden={tab.documentId !== activeDocumentId}
    >
      <EditorDocumentPane documentId={tab.documentId} />
    </div>
  ))}
</div>

```

避免直接使用条件渲染：

```tsx
activeDocumentId === tab.documentId && <EditorDocumentPane />

```

条件渲染会卸载非活动 Excalidraw 实例，可能导致：

- 撤销栈丢失。
- 选区丢失。
- 视口重置。
- 重新加载文件。
- 重复创建 session。

CSS 必须确保：

- 非活动画布不接收鼠标事件。
- 非活动画布不接收键盘焦点。
- 活动画布始终占满编辑区域。
- 切换回来后尺寸计算正确。

---

# 8. 路由和应用 Shell 改造

当前：

```tsx
<Route path="/editor/:documentId" element={<EditorPage />} />

```

建议继续保留 URL 中的活动文档 ID：

```tsx
<Route path="/editor/:documentId" element={<EditorWorkspacePage />} />

```

切换标签时：

```ts
navigate(`/editor/${documentId}`, { replace: true });

```

使用 `replace: true`，避免浏览器历史记录中充满标签切换记录。

打开新标签时：

1. 添加到 `editorStore.tabs`。
2. 激活该标签。
3. 更新路由。

返回工作区时有两种可能实现。

本项目采用以下方案：

> 返回工作区不关闭标签，只切换应用表面。

需要新增应用 Shell，使已经打开的编辑器在返回工作区后继续保留。

建议结构：

```text
App
└── AppShell
    ├── WorkspaceSurface
    ├── EditorSurface
    ├── SettingsSurface
    └── RecoveryDialog

```

当路由为 `/` 时：

- 显示工作区。
- 编辑器表面保持挂载但不可交互。

当路由为 `/editor/:documentId` 时：

- 显示编辑器。
- 工作区表面隐藏。

工作区顶部可以增加：

```text
继续编辑（3）

```

点击后回到最近激活的标签。

如果实现持久化 Shell 的改造风险过高，允许第一阶段返回工作区时卸载编辑器，但必须：

- 先保存所有标签。
- 保留打开标签 ID。
- 再次进入时恢复标签。
- 明确接受撤销栈被重建。

优先采用保持挂载方案。

---

# 9. 保存策略

## 9.1 自动保存

将当前硬编码的：

```ts
800

```

提取为常量：

```ts
const AUTO_SAVE_DELAY_MS = 3000;

```

每个标签独立防抖。

交互规则：

- 用户持续绘制时，不应频繁写磁盘。
- 停止操作 3 秒后自动保存。
- 切换标签时，当前标签如果 dirty，立即触发后台保存。
- 窗口失焦时保存全部 dirty 标签。
- 手动 `Ctrl+S` 只保存当前标签。
- “保存全部”保存所有 dirty 标签。
- 恢复快照仍保持独立计时。

## 9.2 保存期间继续编辑

继续沿用 revision 思路：

```ts
const revisionToSave = revisionRef.current;

```

保存完成后：

```ts
dirtyRef.current = revisionRef.current !== revisionToSave;

```

不能因为旧 revision 保存成功，就把用户在保存期间的新修改标记成已保存。

## 9.3 标签切换

标签切换不能被保存操作阻塞。

流程：

1. 立即切换 UI。
2. 对旧标签启动后台保存。
3. 保存失败时，在旧标签显示错误状态。
4. 不自动切回旧标签。
5. 用户点击错误图标后可回到对应标签处理。

---

# 10. 关闭标签和未保存提示

## 10.1 已保存标签

直接：

1. 关闭 session。
2. 清理自动保存 timer。
3. 清理恢复快照或按现有策略保留。
4. 从 tabs 中移除。
5. 激活相邻标签。

激活顺序：

- 优先激活右侧标签。
- 没有右侧时激活左侧标签。
- 没有其他标签时显示编辑器空状态。

## 10.2 未保存标签

关闭 dirty 标签时显示：

```text
“需求设计”有尚未保存的修改。

[取消] [不保存] [保存并关闭]

```

行为：

### 保存并关闭

1. 强制保存。
2. 保存成功后关闭 session 和标签。
3. 保存失败时保留标签并显示错误。

### 不保存

1. 不写入当前 scene。
2. 关闭 session。
3. 丢弃本次编辑状态。
4. 关闭标签。

### 取消

保持当前状态。

## 10.3 保存失败或冲突

保存失败时不能提供无提示关闭。

提示：

```text
画布保存失败，关闭后可能丢失修改。

[取消] [保存恢复快照后关闭] [重试保存]

```

发生外部修改冲突时：

- 只更新对应标签。
- 对应标签切换到冲突副本。
- 其他标签继续正常工作。
- 不允许整个 EditorWorkspacePage 跳转或重建。

---

# 11. 应用退出

当前生命周期事件只处理一个 `EditorPage`。

改造后由统一协调器处理：

```text
src/renderer/src/features/editor/EditorSessionCoordinator.tsx

```

收到：

```ts
window.desktopApi.lifecycle.onCloseRequested()

```

后：

1. 获取所有 dirty、error、conflict 标签。
2. 如果全部已保存，关闭所有 session，并调用 `readyToClose()`。
3. 如果存在未保存内容，显示统一对话框。

对话框示例：

```text
以下画布尚未保存：

✓ 产品流程图
✓ 数据架构
! 需求草图（保存失败）

[取消退出] [放弃修改并退出] [全部保存并退出]

```

“全部保存并退出”：

- 并发保存可以限制为 2～3 个，避免同时大量写盘。
- 所有保存成功后关闭。
- 任意保存失败则保持应用打开，并显示失败列表。

“放弃修改并退出”：

- 对 dirty 文档优先写恢复快照。
- 关闭所有 session。
- 调用 `readyToClose()`。

“取消退出”：

- 不调用 `readyToClose()`。
- 应用保持打开。

切换工作区时复用同一套未保存检查逻辑。

---

# 12. 跨画布复制粘贴

## 12.1 预期行为

用户在画布 A：

```text
选择元素 → Ctrl+C

```

切换到画布 B：

```text
Ctrl+V

```

应当得到：

- 相同元素。
- 完整分组关系。
- 箭头绑定关系。
- 容器绑定关系。
- 图片等 BinaryFiles。
- 新生成的元素 ID。
- 粘贴后元素被选中。
- 一次 `Ctrl+Z` 可以撤销整个粘贴。

## 12.2 实现原则

第一阶段不要自行重写 Excalidraw 的复制粘贴协议。

先验证多个 Excalidraw 实例之间的原生系统剪贴板行为。

必须先编写人工测试和 E2E 测试，验证：

1. 文本元素。
2. 矩形和箭头。
3. 分组元素。
4. 带图片的元素。
5. 包含中文文本的元素。
6. 从 A 到 B 粘贴。
7. 从 B 再粘贴回 A。
8. 切换标签后剪贴板仍然有效。

只有在图片或 BinaryFiles 确实丢失时，才增加应用内部剪贴板补偿层。

不要全局拦截普通输入框中的 `Ctrl+C` 和 `Ctrl+V`。

键盘事件处理前必须排除：

```ts
input
textarea
[contenteditable="true"]

```

也不要覆盖 Excalidraw 已经处理的复制粘贴事件。

## 12.3 必要时的补偿方案

如果原生复制无法跨实例传递 BinaryFiles，再新增：

```text
src/renderer/src/features/editor/internalClipboard.ts

```

内部保存：

```ts
interface InternalCanvasClipboard {
  elements: readonly unknown[];
  files: Record<string, unknown>;
  copiedAt: number;
  sourceDocumentId: string;
}

```

该补偿只负责当前 CanvasDesk 进程内的跨标签复制。

仍然必须保留系统剪贴板，确保内容可以粘贴到其他应用。

---

# 13. 工作区打开多画布

为了从工作区一次打开多个画布，分两个阶段实现。

## P0

- 双击画布：打开或激活对应标签。
- 编辑器标签栏的 `+`：继续选择其他画布。
- 工作区再次打开已经存在的画布：激活已有标签。

## P1

将：

```ts
selectedDocumentId: string | null

```

升级为：

```ts
selectedDocumentIds: string[]
anchorDocumentId: string | null

```

支持：

- `Ctrl+单击`：增减选择。
- `Shift+单击`：连续选择。
- `Ctrl+A`：选择当前页全部画布。
- 批量打开。
- 批量移动。
- 批量收藏。
- 批量移入回收站。

P1 不应阻塞多标签核心功能上线。

---

# 14. 文件修改清单

## 14.1 必须修改

```text
src/renderer/src/App.tsx
src/renderer/src/pages/WorkspacePage.tsx
src/renderer/src/pages/EditorPage.tsx
src/renderer/src/components/DocumentCard.tsx
src/renderer/src/components/DocumentList.tsx
src/renderer/src/components/DocumentContextMenu.tsx
src/renderer/src/stores/workspaceStore.ts
src/renderer/src/styles/*

```

## 14.2 建议新增

```text
src/renderer/src/pages/EditorWorkspacePage.tsx

src/renderer/src/stores/editorStore.ts

src/renderer/src/components/EditorTabs.tsx
src/renderer/src/components/DocumentQuickActions.tsx
src/renderer/src/components/DocumentPicker.tsx
src/renderer/src/components/MoveDocumentDialog.tsx
src/renderer/src/components/UnsavedDocumentsDialog.tsx

src/renderer/src/features/editor/EditorDocumentPane.tsx
src/renderer/src/features/editor/EditorDocumentHost.tsx
src/renderer/src/features/editor/EditorSessionCoordinator.tsx
src/renderer/src/features/editor/editorTypes.ts

```

## 14.3 尽量不要修改

```text
src/main/storage/*
src/main/services/*
src/main/database/*

```

现有 Desktop API 已经包含：

- create
- open
- save
- rename
- move
- copy
- toggleFavorite
- trash
- restore
- deletePermanently
- reveal
- saveThumbnail
- session.close
- [recovery.save](http://recovery.save)

多标签核心功能可以复用现有 API。

只有在实际实现发现生命周期或 session API 无法满足要求时，才增加最小范围 IPC。

---

# 15. 实施步骤

## 阶段一：建立测试基线

1. 运行：

```bash
npm run typecheck
npm test
npm run lint
npm run test:e2e

```

2. 记录当前失败项。
3. 不要将原有失败误认为本次改造造成。
4. 为当前单画布保存逻辑补充必要测试。

交付结果：

- 当前测试基线说明。
- 不包含业务改动的测试准备提交。

## 阶段二：提取单文档编辑器

1. 将当前 `EditorPage` 内的单文档逻辑提取到 `EditorDocumentPane`。
2. 保持页面外观和功能不变。
3. 暂不增加多标签。
4. 确认保存、恢复、冲突、导出和重命名仍正常。

这是风险最高改造前的结构准备阶段。

交付结果：

- 行为无变化。
- `EditorDocumentPane` 可以通过 `documentId` 独立运行。

## 阶段三：增加 editorStore 和标签栏

1. 创建 `editorStore`。
2. 支持打开、激活和关闭标签。
3. 实现同文档去重。
4. 实现标签顺序。
5. 实现 `Ctrl+Tab`、`Ctrl+Shift+Tab` 和 `Ctrl+W`。
6. 实现 `+` 画布选择器。

交付结果：

- 至少可以稳定打开三个画布。
- 标签切换不会丢失画布内容和视口。
- 每个标签保存状态独立。

## 阶段四：保存和生命周期

1. 将自动保存周期提取为常量。
2. 默认改为 3 秒。
3. 切换标签时后台保存旧标签。
4. 实现关闭未保存标签对话框。
5. 实现应用退出时多文档检查。
6. 实现保存失败和冲突标签状态。

交付结果：

- 不会因关闭错误标签而丢失其他标签修改。
- 任意标签保存失败不会阻塞其他标签。

## 阶段五：工作区快捷操作

1. 增加直接收藏按钮。
2. 提取 `DocumentQuickActions`。
3. 统一网格和列表操作。
4. 重构右键菜单分组。
5. 实现文件夹树移动对话框。
6. 保留现有快捷键。

交付结果：

- 用户无需右键即可收藏。
- 用户无需手动输入路径即可移动画布。

## 阶段六：跨画布复制粘贴

1. 验证 Excalidraw 原生跨实例复制。
2. 编写覆盖普通元素、绑定元素和图片的测试。
3. 只有确实失败时才实现内部剪贴板补偿。
4. 不修改普通文本输入框剪贴板行为。

交付结果：

- A 标签复制，B 标签粘贴稳定可用。
- 图片元素不会变成空白占位。

## 阶段七：回归和交互细节

1. 测试工作区返回和继续编辑。
2. 测试重命名后标签名称同步。
3. 测试收藏后工作区和编辑器同步。
4. 测试移动后相对路径同步。
5. 测试回收站操作。
6. 测试外部修改冲突。
7. 测试应用异常退出恢复。
8. 更新 README 和相关 docs。

---

# 16. 状态同步要求

当画布被重命名：

- 当前标签名称立即更新。
- 编辑器顶部名称立即更新。
- 工作区索引刷新。
- 不重新打开画布。
- 不创建新的 documentId。

当画布被收藏：

- 标签对应元数据更新。
- 编辑器收藏按钮更新。
- 工作区卡片更新。

当画布被移动：

- 标签相对路径更新。
- 打开的 session 继续对应同一个 documentId。
- 后续保存写入新路径。
- 不继续向旧路径保存。

当外部索引变化：

- 已打开标签不能被列表刷新覆盖 scene。
- 只更新安全的文档元数据。
- 如果文件正文发生外部修改，走现有冲突机制。

---

# 17. 测试要求

## 17.1 editorStore 单元测试

覆盖：

- 打开第一个标签。
- 打开第二个标签。
- 重复打开同一文档。
- 关闭活动标签。
- 关闭非活动标签。
- 关闭最后一个标签。
- 调整标签顺序。
- 重命名后更新标签。
- 保存状态只更新目标标签。

## 17.2 保存逻辑测试

覆盖：

- A、B 两个标签同时 dirty。
- A 保存时继续编辑 A。
- A 保存时编辑 B。
- A 保存失败，B 保存成功。
- A 冲突后切换到冲突副本。
- 关闭 A 不影响 B session。
- 退出应用时保存多个标签。
- 保存失败时取消退出。

## 17.3 工作区组件测试

覆盖：

- 点击收藏不打开卡片。
- 点击更多不打开卡片。
- 双击卡片打开。
- `F2` 重命名。
- `Delete` 移入回收站。
- 文件夹树正确生成。
- 移动到根目录。
- 新建文件夹后移动。

## 17.4 E2E 测试

至少添加以下场景：

### 场景一：多标签编辑

1. 新建画布 A。
2. 新建画布 B。
3. 在 A 绘制元素。
4. 切换到 B。
5. 在 B 绘制不同元素。
6. 切回 A。
7. 确认 A 内容仍存在。
8. 保存并重启应用。
9. 确认两个文件内容正确。

### 场景二：跨画布复制

1. 在 A 创建矩形、文字和箭头。
2. 选择并 `Ctrl+C`。
3. 切换到 B。
4. `Ctrl+V`。
5. 确认元素数量和内容。
6. `Ctrl+Z`。
7. 确认一次撤销整个粘贴。

### 场景三：关闭未保存标签

1. 打开 A、B。
2. 修改 A。
3. 关闭 A。
4. 选择取消。
5. A 保持打开。
6. 再次关闭并选择保存。
7. A 关闭，B 不受影响。

### 场景四：退出多个未保存标签

1. 修改 A 和 B。
2. 关闭应用。
3. 显示两个未保存画布。
4. 选择全部保存并退出。
5. 重启后验证两个文件。

### 场景五：重命名和移动

1. 打开 A。
2. 返回工作区。
3. 重命名 A。
4. 移动 A。
5. 返回编辑器。
6. 标签名称和路径均已更新。
7. 后续保存写入新位置。

---

# 18. 验收标准

全部满足后才能认为任务完成。

## 工作区

- 卡片和列表都能直接收藏。
- 更多操作不会误触发打开。
- 重命名、复制、收藏、移动和删除入口一致。
- 移动画布不需要手动输入路径。
- 可以选择根目录和已有文件夹。
- 可以在移动对话框中新建文件夹。
- 原有回收站功能未退化。

## 多标签

- 可以同时打开至少三个画布。
- 同一画布不会重复打开。
- 每个标签保存状态独立。
- 标签切换不会丢失 scene。
- 标签切换不会重建 session。
- 标签切换不会丢失撤销历史。
- `Ctrl+Tab` 可以切换标签。
- `Ctrl+W` 只关闭当前标签。
- 中键可以关闭标签。
- 关闭标签后激活相邻标签。
- 标签顺序可以拖拽调整。

## 保存

- 自动保存按文档独立运行。
- 保存期间的新修改不会被错误标记为已保存。
- 保存失败只影响对应标签。
- 冲突副本只替换对应标签。
- 退出应用可以统一保存全部 dirty 标签。
- 用户可以取消退出。
- 用户放弃修改前会保存恢复快照。

## 剪贴板

- 可以从 A 复制普通元素到 B。
- 可以复制分组和绑定关系。
- 可以复制包含图片的元素。
- 粘贴后生成新 ID。
- 一次撤销可以撤销整次粘贴。
- 普通输入框复制粘贴不受影响。

## 工程质量

- `npm run typecheck` 通过。
- `npm test` 通过。
- `npm run lint` 通过。
- 相关 E2E 测试通过。
- README 或 docs 已更新。
- 不引入新的全局单例保存状态。
- 不破坏现有 `.excalidraw` 文件兼容性。

---

# 19. 提交要求

不要将全部改动放入一个超大提交。

建议提交顺序：

```text
refactor(editor): extract single document editor pane
feat(editor): add editor tab state and tab bar
feat(editor): support multiple mounted canvas documents
feat(editor): handle dirty tab close and app shutdown
feat(workspace): add direct document quick actions
feat(workspace): add folder picker for document move
test(editor): cover multi-tab save and clipboard workflows
docs: document multi-tab interaction behavior

```

每个提交都必须：

- 可以通过类型检查。
- 不包含无关格式化。
- 不大规模重命名无关文件。
- 不重写现有 StorageProvider。
- 不删除现有冲突和恢复机制。

---

# 20. Agent 执行约束

执行时遵循以下原则：

1. 先阅读当前实现，再修改。
2. 优先复用现有 Desktop API。
3. 先提取单文档逻辑，再实现多标签。
4. 不要直接在当前 `EditorPage.tsx` 中堆叠多个条件分支。
5. 不要使用单个全局 `dirty` 表示所有文档。
6. 不要在标签切换时重新读取磁盘文件。
7. 不要自行重新实现 Excalidraw 剪贴板，除非测试证明原生行为不满足要求。
8. 不要让保存操作阻塞标签切换。
9. 不要因一个标签保存失败而阻塞其他标签。
10. 每完成一个阶段，先运行测试并报告结果，再继续下一阶段。

最终交付时输出：

- 修改文件列表。
- 核心架构说明。
- 交互行为说明。
- 测试执行结果。
- 已知限制。
- 后续建议。

