# CanvasDesk 保存系统可靠性重构执行方案

> 任务名称：Save System V2 — Reliable Document Persistence  
> 仓库：`Nicander93/my-excaildraw-local`  
> 审阅基线：`main` 分支，commit `53e9cde8978dec4b5ca35c914f66627f3fe2bcf7`  
> 主要平台：Windows 10/11  
> 目标读者：Coding Agent / 代码维护者  
> 优先级：P0  
> 建议实施方式：分阶段提交，每个阶段保持可构建、可测试

---

## 1. 任务目标

本任务不是简单地把自动保存从 `800ms` 改成 `5000ms`，而是修复当前保存链路中的并发、Windows 文件替换、退出流程和未保存确认问题。

完成后必须满足：

1. 自动保存采用“停止编辑 5 秒后保存 + 持续编辑最长 30 秒保存一次”。
2. 任意时刻，同一编辑器会话最多只有一个正文保存请求真正写入文件。
3. `Ctrl+S`、自动保存、返回工作区、关闭窗口等入口全部经过同一个保存协调器。
4. Windows 保存失败不能破坏原文件，不能通过原地 `copyFile` 覆盖来伪装成“原子写入”。
5. 离开当前画布、关闭窗口或退出应用时，如果仍存在未保存修改，必须提供：
   - 保存并继续；
   - 不保存并继续；
   - 取消。
6. 用户主动选择“不保存”后，应清除该画布的恢复快照，避免下次启动再次提示恢复已明确丢弃的内容。
7. 保存失败时不得静默退出，也不得把 `dirty` 状态误判为已保存。
8. 保留现有外部修改检测、冲突副本和异常恢复能力。
9. 不在本次任务中实现云同步、文件锁、多端合并或版本历史。

---

## 2. 当前代码审阅结论

### 2.1 当前调用链

现有保存调用链如下：

```text
EditorPage
  -> window.desktopApi.documents.save()
  -> Preload
  -> IPC: documents:save
  -> DocumentService.save()
  -> LocalStorageProvider.write()
  -> 本地 .excalidraw 文件
```

相关文件：

```text
src/renderer/src/pages/EditorPage.tsx
src/preload/index.ts
src/shared/channels.ts
src/shared/types.ts
src/shared/schemas.ts
src/main/ipc/registerIpcHandlers.ts
src/main/services/DocumentService.ts
src/main/storage/StorageProvider.ts
src/main/storage/LocalStorageProvider.ts
src/main/index.ts
```

### 2.2 当前已经实现的能力

当前代码已经具备：

- `EditorPage` 内部保存状态：
  - `saved`
  - `saving`
  - `dirty`
  - `error`
  - `conflict`
- `800ms` 防抖自动保存。
- `Ctrl+S` 强制保存。
- `window.blur` 强制保存。
- 返回工作区前强制保存。
- 关闭窗口前强制保存或写入 Recovery。
- 每 10 秒写入恢复快照。
- 基于正文 SHA-256 的外部修改检测。
- 外部修改时生成冲突副本。
- 正文保存成功后异步生成缩略图。
- `StorageProvider.write()` 已支持 `expectedVersion`。
- `LocalStorageProvider` 已采用临时文件、`fsync` 和 `rename`。
- Windows `EPERM` / `EEXIST` 时已有 `copyFile` 回退。

### 2.3 本次不要重复实现的内容

最新代码已经将缩略图改为：

```ts
void saveThumbnail();
```

因此正文保存不再等待缩略图完成。本次只需要补测试和确保后续重构不回退，不要再次设计一套缩略图队列。

---

## 3. 当前核心问题

## 3.1 `performSave()` 存在保存 Promise 竞态

当前 `EditorPage.tsx` 中的主要逻辑：

```ts
if (savePromiseRef.current) {
  const previousSaveSucceeded = await savePromiseRef.current;
  if (force && dirtyRef.current) {
    return performSave(true);
  }
}

...

if (dirtyRef.current && saved && force) {
  savePromiseRef.current = null;
  return performSave(true);
}

...

finally {
  savePromiseRef.current = null;
}
```

问题在于：

1. 第一次保存尚未完全退出。
2. 代码把 `savePromiseRef.current` 设为 `null`。
3. 递归启动第二次保存。
4. 第一次保存外层的 `finally` 随后继续执行。
5. 外层 `finally` 再次将 `savePromiseRef.current` 清空。
6. 第二次保存实际上仍在执行，但第三个保存请求会认为当前没有保存任务。
7. 最终可能产生并发写入。

这不是调大自动保存周期可以解决的问题，必须取消递归 Promise 保存方式。

---

## 3.2 Windows `copyFile` 回退不是安全替换

当前 `LocalStorageProvider.write()`：

```ts
try {
  await rename(temporaryPath, absolutePath);
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== "EPERM" && code !== "EEXIST") {
    throw error;
  }
  await copyFile(temporaryPath, absolutePath);
  await unlink(temporaryPath).catch(() => undefined);
}
```

`copyFile(temp, target)` 会直接改写目标文件。

如果在复制期间发生以下情况：

- 应用崩溃；
- 系统断电；
- 磁盘空间不足；
- 杀毒软件或同步软件中途占用文件；
- 写入过程抛出异常；

目标文件可能已经被部分覆盖。

因此它只能算“兼容性回退”，不能算原子写入，也不能满足“失败时保留原文件”的契约。

本次必须将其替换为“临时文件 + 旧文件备份 + 替换 + 失败恢复”的故障安全流程。

---

## 3.3 退出流程无法真正取消

当前 `src/main/index.ts`：

```ts
let closeRequested = false;

mainWindow.on("close", (event) => {
  if (closeRequested || mainWindow?.isDestroyed()) {
    return;
  }

  event.preventDefault();
  closeRequested = true;
  mainWindow?.webContents.send("app:close-requested");

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
  }, 5_000);
});
```

当前存在以下问题：

1. 第一次关闭后，`closeRequested` 永远变为 `true`，没有“用户取消关闭”后的复位流程。
2. Renderer 无论保存成功还是失败，最终都会调用：

   ```ts
   window.desktopApi.lifecycle.readyToClose();
   ```

3. Main 收到后直接：

   ```ts
   BrowserWindow.fromWebContents(event.sender)?.destroy();
   ```

4. `destroy()` 绕过正常窗口关闭流程。
5. 固定 5 秒后强制销毁意味着：
   - 用户还在确认弹窗中也可能被关闭；
   - 慢磁盘保存超过 5 秒也会被关闭；
   - 保存失败后写 Recovery 尚未完成也可能被关闭。
6. 当前协议没有：
   - `proceed`
   - `cancel`
   - `requestId`
   - 重复关闭请求处理。

必须重构为可取消的关闭握手。

---

## 3.4 当前没有“保存 / 不保存 / 取消”交互

当前返回工作区逻辑：

```ts
const saved = await performSave(true);
if (!saved && dirtyRef.current) {
  return;
}
navigate("/");
```

当前关闭应用逻辑：

```ts
const saved = await performSave(true);

if (!saved && dirtyRef.current) {
  await saveRecoverySnapshot();
}

window.desktopApi.lifecycle.readyToClose();
```

问题：

- 返回工作区只会尝试保存，失败后停留，没有明确提示。
- 关闭应用即使保存失败，也会写快照后关闭。
- 用户无法明确选择“不保存”。
- 用户无法取消关闭。
- 用户不知道保存失败后应用是否仍会退出。
- 主动丢弃修改后，已有 Recovery 仍可能在下次启动提示。

---

## 3.5 `DocumentService.save()` 存在检查后再写入的竞态窗口

当前逻辑：

```ts
const currentData = await provider.read(document.relativePath);
const currentHash = hashData(currentData);

if (currentHash !== versionContentHash(input.expectedVersion)) {
  return this.createConflictCopy(...);
}

const fileData = serializeScene(input.sceneData);
await provider.write(document.relativePath, fileData);
```

最新代码为了避免 mtime 变化造成误判，改为仅比较正文哈希，但保存时没有再向 Provider 传入 `expectedVersion`。

因此存在以下窗口：

```text
读取当前文件并确认哈希一致
        ↓
外部程序修改文件
        ↓
当前应用执行 provider.write()
        ↓
覆盖外部修改
```

本次应保留“正文哈希是最终冲突依据”的策略，同时重新使用 Provider 的版本检查来缩小检查后写入竞态窗口。

---

## 3.6 `ignoreChangesUntilRef = Date.now() + 250` 依赖时间猜测

当前通过 250ms 忽略 Excalidraw 初始化阶段的 `onChange`：

```ts
ignoreChangesUntilRef.current = Date.now() + 250;
```

这在不同机器上不稳定：

- 较慢机器或大画布可能超过 250ms。
- 较快机器则产生无意义等待。
- 初始化、字体加载、图片加载可能触发更晚的变化。

应改为基于编辑器初始化状态或首个稳定 Scene 建立基线，而不是依赖固定时间。

此项优先级低于保存队列和 Windows 文件安全替换，但应在本次重构中一并移除。

---

## 3.7 `window.blur` 触发强制保存过于激进

当前：

```ts
window.addEventListener("blur", saveOnBlur);
```

Windows 下以下行为都可能触发窗口失焦：

- 打开文件选择框；
- 打开导出对话框；
- 点击任务栏；
- 切换输入法或系统窗口；
- 打开资源管理器；
- 显示其他 Electron 窗口。

直接 `performSave(true)` 会绕过 5 秒自动保存策略，并放大保存并发和文件占用问题。

本次建议删除失焦强制保存。已有以下保护即可：

- 5 秒自动保存；
- 30 秒最长保存；
- 10 秒 Recovery；
- 返回、关闭和退出前的显式确认。

---

## 3.8 `before-quit` 中过早释放服务

当前：

```ts
app.on("before-quit", () => {
  void workspaceService?.dispose();
  database?.close();
});
```

如果未来通过 `before-quit` 触发窗口关闭确认并允许用户取消，那么数据库和文件监听可能已经被关闭，而 UI 仍继续运行。

本次关闭协议重构时，应确保：

- 用户取消退出时，不释放服务。
- 只有确定退出后才执行清理。
- 清理放在受控的最终退出路径或 `will-quit` 阶段。

---

## 4. 本次实施范围

## 4.1 必须完成

- 保存协调器 / 串行保存队列。
- 5 秒防抖自动保存。
- 30 秒最大等待保存。
- 删除 `window.blur` 强制保存。
- Windows 故障安全文件替换。
- Provider 写入结果和写入契约小幅升级。
- DocumentService 冲突检查竞态修复。
- 返回工作区未保存确认。
- 关闭窗口 / 退出应用未保存确认。
- 可取消的 Main ↔ Renderer 关闭握手。
- 保存失败、冲突和 Recovery 的正确处理。
- 单元测试、集成测试和关键 E2E 测试。
- 更新可靠性文档和 README。

## 4.2 明确不做

- OSS、S3、MinIO、WebDAV。
- 云端同步队列。
- 多设备冲突合并。
- 元素级冲突合并。
- 文件锁。
- 多窗口同时编辑。
- 多画布 Tab。
- 文件版本历史。
- 自动备份保留策略。
- 自动保存设置页。
- 新增原生依赖以调用 Windows `ReplaceFileW`。

---

## 5. 目标保存规则

## 5.1 自动保存

默认常量：

```ts
export const AUTO_SAVE_DEBOUNCE_MS = 5_000;
export const AUTO_SAVE_MAX_WAIT_MS = 30_000;
export const RECOVERY_INTERVAL_MS = 10_000;
```

规则：

1. 第一次产生未保存修改时：
   - 启动 5 秒防抖计时器；
   - 启动 30 秒最长等待计时器。
2. 后续每次修改：
   - 重置 5 秒防抖计时器；
   - 不重置 30 秒最长等待计时器。
3. 用户停止编辑 5 秒：
   - 请求自动保存。
4. 用户持续编辑超过 30 秒：
   - 请求保存当前最新快照。
5. 保存期间继续编辑：
   - 当前保存只负责它开始时捕获的 revision；
   - 保存完成后发现 revision 已变化，继续执行下一轮保存；
   - 不并发写入。
6. 保存成功且没有更新的 revision：
   - 清除两个自动保存计时器；
   - 状态变为 `saved`。
7. 保存失败：
   - 保持未保存状态；
   - 状态变为 `error`；
   - 写入 Recovery；
   - 不进行无限自动重试。

---

## 5.2 手动保存

`Ctrl+S`：

- 立即取消当前 5 秒等待。
- 进入同一个保存队列。
- 等待队列将最新 revision 保存完成。
- 不创建第二套保存逻辑。
- 连续多次按 `Ctrl+S` 不得并发写文件。

---

## 5.3 离开画布

所有离开 `EditorPage` 的入口必须调用同一个函数，例如：

```ts
requestLeaveDocument(reason, continueAction)
```

当前至少包括：

- 顶部“工作区”按钮。
- `Ctrl+W`。
- 未来可能增加的设置入口。
- 工作区切换前离开编辑器。
- 窗口关闭。
- 应用退出。

不能直接在各入口分别编写保存代码。

---

## 5.4 退出或切换时的确认规则

### 已保存

```text
直接继续
```

### 正在保存

```text
等待当前保存结束
  ├─ 成功：继续
  └─ 失败：显示保存失败确认框
```

### 存在未保存修改

显示：

```text
是否保存对“画布名称”的修改？

未保存的修改将在离开后丢失。

[保存并继续] [不保存] [取消]
```

根据场景替换按钮文字：

- 保存并返回工作区
- 保存并退出
- 保存并切换工作区

### 保存失败

显示：

```text
“画布名称”保存失败

错误信息：xxx

[重试保存] [不保存并继续] [取消]
```

### 用户选择“不保存”

必须依次执行：

1. 取消自动保存计时器。
2. 阻止后续排队保存。
3. 调用：

   ```ts
   window.desktopApi.recovery.discard(document.id)
   ```

4. 正常关闭 session。
5. 执行导航、切换或退出动作。

用户已经明确选择丢弃，不应保留 Recovery 并在下次启动再次询问。

### 用户选择“取消”

- 保持当前画布。
- 保持 `dirty`。
- 恢复正常自动保存能力。
- 对窗口关闭请求返回 `cancel`。
- Main 进程不得关闭窗口或释放服务。

---

## 6. 保存状态模型

建议将类型从 `EditorPage.tsx` 移到：

```text
src/renderer/src/features/editor/saveTypes.ts
```

建议定义：

```ts
export type SaveStatus =
  | "saved"
  | "dirty"
  | "saving"
  | "error"
  | "conflict";

export type SaveReason =
  | "auto-debounce"
  | "auto-max-wait"
  | "manual"
  | "leave-editor"
  | "switch-workspace"
  | "close-window"
  | "exit-app"
  | "retry";

export type LeaveReason =
  | "return-workspace"
  | "switch-workspace"
  | "close-window"
  | "exit-app";

export type SaveOutcome =
  | { status: "saved" | "noop" }
  | { status: "conflict"; persisted: boolean; message: string }
  | { status: "failed"; message: string };
```

注意：

- 是否存在未保存内容应由 revision 判断，不要只看 UI 的 `SaveStatus`。
- 冲突副本已成功落盘时，虽然 UI 可以显示“检测到外部修改”，但不应误判为内容仍未持久化。
- `error` 必须意味着最新 revision 尚未成功写入。

---

## 7. 保存协调器设计

## 7.1 建议新增文件

```text
src/renderer/src/features/editor/DocumentSaveCoordinator.ts
src/renderer/src/features/editor/DocumentSaveCoordinator.test.ts
src/renderer/src/features/editor/saveTypes.ts
```

也可以实现为 Hook，但保存队列核心必须提取为可独立测试的纯 TypeScript 模块。

建议由 `EditorPage` 保留：

- Scene 获取；
- Excalidraw Adapter；
- 文档切换；
- 冲突副本导航；
- Modal 展示。

保存协调器负责：

- revision；
- 保存串行化；
- 自动保存计时器；
- 保存请求合并；
- 状态回调；
- dispose。

---

## 7.2 保存快照

保存开始时必须捕获不可变快照：

```ts
interface SaveSnapshot {
  revision: number;
  documentId: string;
  expectedVersion: string;
  sceneData: ExcalidrawFile;
  reason: SaveReason;
}
```

不能在异步保存过程中持续读取可变化的 `sceneRef.current` 作为同一次保存的内容。

---

## 7.3 revision 规则

建议替代当前 `dirtyRef + revisionRef` 的混合判断：

```ts
private latestRevision = 0;
private persistedRevision = 0;
```

规则：

```ts
hasUnsavedChanges = latestRevision !== persistedRevision;
```

每次有效 Scene 修改：

```ts
latestRevision += 1;
```

保存开始：

```ts
const revisionToSave = latestRevision;
```

保存成功：

```ts
persistedRevision = Math.max(persistedRevision, revisionToSave);
```

如果保存期间又产生修改：

```ts
latestRevision > persistedRevision
```

则继续下一轮，但仍由同一个 drain loop 串行执行。

---

## 7.4 禁止递归，使用 drain loop

不要继续使用：

```ts
return performSave(true);
```

建议逻辑：

```ts
private drainPromise: Promise<SaveOutcome> | null = null;
private saveRequested = false;
private forceLatestRevision = false;

requestSave(reason: SaveReason): Promise<SaveOutcome> {
  this.saveRequested = true;

  if (reason !== "auto-debounce" && reason !== "auto-max-wait") {
    this.forceLatestRevision = true;
  }

  if (!this.drainPromise) {
    this.drainPromise = this.drain(reason).finally(() => {
      this.drainPromise = null;
    });
  }

  return this.drainPromise;
}

private async drain(initialReason: SaveReason): Promise<SaveOutcome> {
  let outcome: SaveOutcome = { status: "noop" };

  while (this.saveRequested && this.hasUnsavedChanges()) {
    this.saveRequested = false;

    const snapshot = this.createSnapshot(initialReason);
    outcome = await this.executeSave(snapshot);

    if (outcome.status === "failed") {
      break;
    }

    if (this.hasUnsavedChanges()) {
      this.saveRequested = true;
    }
  }

  return outcome;
}
```

实际实现可以调整，但必须满足：

- 不递归。
- `drainPromise` 只在整个 drain 完成后清空。
- 新请求只设置 pending 标记。
- 任意时刻最多一个 `documents.save()` 在执行。
- `requestSave()` 返回值代表本次队列排空后的结果，而不是仅代表某个旧保存任务。

---

## 7.5 保存请求优先级

不必实现复杂优先级队列，但必须区分：

### 延迟请求

- `auto-debounce`
- `auto-max-wait`

### 立即请求

- `manual`
- `leave-editor`
- `switch-workspace`
- `close-window`
- `exit-app`
- `retry`

立即请求应：

- 清除 debounce timer。
- 立即启动或加入当前 drain。
- 等待最新 revision 被处理。

多个请求可以合并，不要求为每个 reason 写一次文件。

---

## 7.6 自动保存计时器

建议协调器内部维护：

```ts
private debounceTimer: number | null = null;
private maxWaitTimer: number | null = null;
```

第一次从 clean 变为 dirty：

```ts
scheduleDebounce();
scheduleMaxWait();
```

后续修改：

```ts
resetDebounce();
keepExistingMaxWait();
```

保存成功且 clean：

```ts
clearDebounce();
clearMaxWait();
```

保存失败：

```ts
clearDebounce();
clearMaxWait();
```

错误状态下不要无限每 5 秒重试。用户继续修改时，可以重新安排一次自动保存；用户也可点击“重试”。

---

## 8. `EditorPage` 重构要求

## 8.1 应移出的逻辑

从 `EditorPage.tsx` 中移出：

- `savePromiseRef`
- 自动保存 timer 管理
- 保存递归
- 保存请求合并
- revision 持久化判断

`EditorPage` 仍负责：

- 获取 `document`；
- 获取 Scene；
- 更新 `versionRef`；
- 保存结果后的文档状态更新；
- 冲突副本处理；
- 展示保存状态；
- Leave Confirm Modal；
- 导航。

---

## 8.2 移除 250ms 初始化忽略

删除：

```ts
ignoreChangesUntilRef
```

建议改为：

```ts
const editorReadyRef = useRef(false);
```

基本流程：

1. 文档加载时：

   ```ts
   editorReadyRef.current = false;
   ```

2. `excalidrawAPI` 可用后：
   - 获取 Excalidraw 已应用 `initialData` 后的当前 Scene；
   - 用该 Scene 建立当前基线；
   - 再设置：

     ```ts
     editorReadyRef.current = true;
     ```

3. `handleSceneChange()`：
   - 初始化期间只更新 `sceneRef` 和 `sceneRuntimeRef`；
   - 初始化完成后才调用 `coordinator.markChanged()`。

禁止重新引入任意毫秒数的初始化窗口。

---

## 8.3 删除 blur 强制保存

删除：

```ts
window.addEventListener("blur", saveOnBlur);
```

不要替换成另一个直接保存入口。

正常自动保存和离开确认已经覆盖该场景。

---

## 8.4 返回工作区

将：

```ts
performSave(true)
```

替换为统一流程：

```ts
void requestLeaveDocument("return-workspace", async () => {
  await closeSession();
  await refreshWorkspace();
  navigate("/");
});
```

`requestLeaveDocument()` 根据保存状态决定：

- 直接执行；
- 等待保存；
- 显示确认框；
- 保存并执行；
- 不保存并执行；
- 取消。

---

## 8.5 `Ctrl+W`

`Ctrl+W` 不再直接调用返回函数内部的强制保存，而是使用同一个 Leave Guard：

```ts
requestLeaveDocument("return-workspace", ...);
```

---

## 8.6 导出

导出前调用：

```ts
await coordinator.requestSave("manual");
```

只有保存结果可接受时才继续读取正式文件导出。

PNG/SVG 直接根据当前 Scene 导出时，可继续使用当前内存 Scene，但需要明确：

- `.excalidraw` 文件导出必须在正文保存成功后执行；
- PNG/SVG 导出失败不能改变保存状态；
- 导出对话框触发 blur 时不会再产生额外强制保存。

---

## 9. Leave Confirm Dialog

建议新增：

```text
src/renderer/src/components/UnsavedChangesDialog.tsx
```

复用现有：

```text
src/renderer/src/components/Modal.tsx
```

建议 Props：

```ts
interface UnsavedChangesDialogProps {
  documentName: string;
  reason: LeaveReason;
  errorMessage?: string;
  saving: boolean;
  onSave(): void;
  onDiscard(): void;
  onCancel(): void;
}
```

交互要求：

- 保存过程中禁用重复点击。
- 保存失败后 Modal 保持打开并展示错误。
- Escape 等价于取消。
- 点击遮罩等价于取消，不能等价于不保存。
- 默认焦点应放在“保存并继续”。
- “不保存”使用危险或次要样式，不得作为默认按钮。
- 文案必须明确“不保存会丢失修改”。

---

## 10. Main ↔ Renderer 关闭协议重构

## 10.1 Shared 类型

在 `src/shared/types.ts` 增加：

```ts
export interface AppCloseRequest {
  requestId: string;
  reason: "window-close" | "app-quit";
}

export interface AppCloseResponse {
  requestId: string;
  decision: "proceed" | "cancel";
}
```

---

## 10.2 IPC Channels

调整 `src/shared/channels.ts`：

```ts
appCloseRequested: "app:close-requested",
appCloseResponded: "app:close-responded"
```

废弃：

```ts
appReadyToClose
```

可先保留常量一轮迁移，但最终不应继续使用。

---

## 10.3 Preload API

将：

```ts
lifecycle: {
  onCloseRequested(listener: () => void): () => void;
  readyToClose(): void;
}
```

调整为：

```ts
lifecycle: {
  onCloseRequested(
    listener: (request: AppCloseRequest) => void
  ): () => void;

  respondToClose(response: AppCloseResponse): void;
}
```

Preload 仍只暴露固定通道，不开放通用 IPC。

---

## 10.4 Main 关闭状态

`src/main/index.ts` 建议维护：

```ts
let pendingCloseRequestId: string | null = null;
let allowWindowClose = false;
let allowAppQuit = false;
```

窗口关闭：

```ts
mainWindow.on("close", (event) => {
  if (allowWindowClose) {
    return;
  }

  event.preventDefault();

  if (pendingCloseRequestId) {
    return;
  }

  const requestId = randomUUID();
  pendingCloseRequestId = requestId;

  mainWindow.webContents.send(IPC_CHANNELS.appCloseRequested, {
    requestId,
    reason: "window-close"
  });
});
```

Renderer 响应：

```ts
ipcMain.on(IPC_CHANNELS.appCloseResponded, (event, responseInput) => {
  const response = appCloseResponseSchema.parse(responseInput);

  if (response.requestId !== pendingCloseRequestId) {
    return;
  }

  pendingCloseRequestId = null;

  if (response.decision === "cancel") {
    return;
  }

  allowWindowClose = true;
  allowAppQuit = true;
  BrowserWindow.fromWebContents(event.sender)?.close();
});
```

要求：

- 不再使用 `destroy()` 作为正常关闭方式。
- 不再固定 5 秒后无条件销毁。
- 用户取消后 `pendingCloseRequestId` 必须复位。
- 重复点击关闭时只保留一个请求。
- 旧 requestId 的延迟响应必须被忽略。

---

## 10.5 App 级监听集中化

当前 `EditorPage`、`WorkspacePage` 和 `SettingsPage` 分别注册关闭监听。

建议改为：

```text
src/renderer/src/App.tsx
```

只注册一次全局关闭监听。

实现方式可选：

### 推荐方式

新增轻量的关闭协调上下文：

```text
src/renderer/src/features/lifecycle/AppCloseContext.tsx
```

`EditorPage` 在挂载时注册自己的关闭处理器，卸载时注销。

`App.tsx` 收到 Main 请求后：

- 当前存在 Editor handler：调用该 handler；
- 当前没有 Editor handler：直接回复 `proceed`。

这样可以删除：

```ts
WorkspacePage.tsx
SettingsPage.tsx
EditorPage.tsx
```

中分散的 `onCloseRequested()` 注册。

### 最低可接受方式

仍由页面监听，但必须保证：

- 同一时刻只有当前页面有监听器。
- Editor 可以异步等待用户选择。
- Workspace / Settings 立即回复 `proceed`。
- 所有页面使用新的 requestId 协议。

推荐采用 App 级集中监听，后续多画布 Tab 也更容易扩展。

---

## 10.6 `before-quit` 和清理

不要在用户尚未确认时关闭数据库。

建议：

```ts
app.on("before-quit", (event) => {
  if (allowAppQuit) {
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    event.preventDefault();
    mainWindow.close();
  }
});
```

最终清理放到受控退出路径或：

```ts
app.on("will-quit", () => {
  logger?.info("app.quit");
  database?.close();
});
```

`WorkspaceService.dispose()` 是异步的。应在设置 `allowAppQuit = true` 之前尽量完成：

```ts
await workspaceService?.dispose();
allowWindowClose = true;
allowAppQuit = true;
mainWindow.close();
```

如果不方便在 IPC listener 中直接清理，应新增统一：

```ts
shutdownApplicationServices()
```

并保证只执行一次。

---

## 11. 工作区切换保护

当前代码结构中，切换工作区入口位于：

```text
src/renderer/src/pages/SettingsPage.tsx
```

而 `EditorPage` 和 `SettingsPage` 是互斥路由。也就是说，当前用户必须先离开编辑器，才能进入设置并切换工作区。

因此本次正确实现路径是：

1. 所有离开 `EditorPage` 的入口必须经过 Leave Guard。
2. 用户有未保存修改时，在离开编辑器前确认。
3. 只有成功离开编辑器后，才能进入设置页。
4. 设置页的 `chooseWorkspace()` 继续负责目录选择和扫描。

为了防止未来在 Editor 顶部直接加入“切换工作区”，应：

- 将 Leave Guard 设计为可复用函数；
- 新增 `LeaveReason = "switch-workspace"`；
- 禁止未来直接从 Editor 调用 `workspace.choose()`。

本次无需为当前 SettingsPage 增加一个无法访问已卸载 Editor 状态的复杂全局 dirty store。

---

## 12. StorageProvider 轻量升级

## 12.1 当前接口已有能力

当前接口已经存在：

```ts
write(
  path: string,
  data: Uint8Array,
  options?: {
    expectedVersion?: string;
    contentType?: string;
  }
): Promise<StorageWriteResult>;
```

因此本次不要增加：

```ts
backup()
restore()
lock()
unlock()
writeAtomic()
```

安全写入应当是 `write()` 的契约，由具体 Provider 内部实现。

---

## 12.2 调整写入结果

当前：

```ts
export interface StorageWriteResult {
  version?: string;
  modifiedAt?: number;
}
```

建议本次改为：

```ts
export interface StorageWriteResult {
  version: string;
  modifiedAt: number;
  size: number;
}
```

原因：

- `LocalStorageProvider.write()` 成功后一定可以 stat。
- `DocumentService.save()` 可直接使用结果构造版本。
- 避免保存后再次执行一次独立 `stat()`。
- 未来远端 Provider 可将 ETag 映射为 version。

同步调整：

```ts
const buildVersion = (
  result: Pick<StorageWriteResult, "modifiedAt" | "size">,
  contentHash: string
): string => `${result.modifiedAt}:${result.size}:${contentHash}`;
```

如果不希望一次性把字段改成必填，也至少必须新增 `size?: number` 并在 Local Provider 中完整返回。推荐直接改为必填，因为当前只有 Local Provider。

---

## 12.3 写入契约

在 `StorageProvider.ts` 注释中明确：

```text
write() 成功：
- 目标内容必须完整可读；
- 返回目标的新版本信息。

write() 失败：
- 原目标文件必须保持为调用前的完整版本；
- 不允许留下半写入目标文件；
- 临时文件和备份应尽量清理；
- 无法清理时不得影响下次恢复。
```

“原子”一词在 Windows 无原生 ReplaceFileW 支持时应谨慎使用。当前无新增原生依赖，本次目标是“故障安全替换和可恢复”，不是承诺所有平台的严格单系统调用原子性。

---

## 13. Windows 故障安全替换

## 13.1 删除 `copyFile(temp, target)` 回退

禁止继续：

```ts
await copyFile(temporaryPath, absolutePath);
```

直接覆盖正式文件。

---

## 13.2 建议新增内部函数

在：

```text
src/main/storage/LocalStorageProvider.ts
```

新增私有方法：

```ts
private async replaceFileSafely(
  temporaryPath: string,
  absolutePath: string
): Promise<void>
```

也可以拆到：

```text
src/main/storage/safeFileReplace.ts
```

便于单元测试。

---

## 13.3 推荐流程

对每个目标文件使用确定性备份名称，例如：

```ts
const backupPath = resolve(
  dirname(absolutePath),
  `.${basename(absolutePath)}.canvasdesk-backup`
);
```

保存前恢复上一次中断状态：

```text
backup 存在，target 不存在
  -> 将 backup 恢复为 target

backup 存在，target 存在
  -> target 是有效正式文件
  -> 删除 stale backup
```

正式写入：

```text
1. 创建随机 temp
2. 写入完整数据
3. fileHandle.sync()
4. 关闭 temp
5. target 不存在：
     rename(temp, target)
6. target 存在：
     rename(target, backup)
     rename(temp, target)
     删除 backup
```

失败恢复：

```text
rename(target, backup) 失败
  -> target 未修改
  -> 删除 temp
  -> 抛出错误

rename(temp, target) 失败
  -> 尝试 rename(backup, target)
  -> 保留完整旧文件
  -> 删除 temp
  -> 抛出错误

删除 backup 失败
  -> 新 target 已完整就位
  -> 记录 warning
  -> 下次写入前清理 stale backup
```

注意：

- 如果目标被 Windows、Defender、坚果云客户端或其他进程锁定，`rename(target, backup)` 可能失败。
- 此时必须返回保存失败，不能退回原地覆盖。
- 保存失败后 UI 保持 dirty，并写 Recovery。
- 不要为了“保存成功率”牺牲原文件完整性。

---

## 13.4 目录同步

在 POSIX 平台可以尝试对父目录执行 `fsync`，保证 rename 元数据更可靠。

Windows 或不支持目录 handle 的平台可捕获并忽略不支持错误。

此项属于增强项，不得阻塞核心修复。

---

## 14. DocumentService 冲突检查改造

## 14.1 保留正文哈希作为语义冲突依据

当前使用完整文件 SHA-256 判断正文是否真的变化，这是合理的。

不要仅因 mtime 改变就生成冲突副本。

---

## 14.2 重新使用 Provider `expectedVersion`

建议流程：

```ts
async save(input: SaveDocumentInput): Promise<SaveResult> {
  const document = this.requireDocument(input.documentId);
  const provider = this.workspaceService.getStorageProvider();

  const currentData = await provider.read(document.relativePath);
  const currentHash = hashData(currentData);

  if (currentHash !== versionContentHash(input.expectedVersion)) {
    return this.createConflictCopy(document, input.sceneData);
  }

  const currentEntry = await this.requireStat(document.relativePath);
  const fileData = serializeScene(input.sceneData);

  try {
    const writeResult = await provider.write(
      document.relativePath,
      fileData,
      { expectedVersion: currentEntry.version }
    );

    ...
  } catch (error) {
    if (isStorageVersionConflict(error)) {
      const latestData = await provider.read(document.relativePath);
      const latestHash = hashData(latestData);

      if (latestHash !== currentHash) {
        return this.createConflictCopy(document, input.sceneData);
      }

      // 仅元数据变化但正文相同，可重新 stat 后最多重试一次。
      const latestEntry = await this.requireStat(document.relativePath);
      const writeResult = await provider.write(
        document.relativePath,
        fileData,
        { expectedVersion: latestEntry.version }
      );

      ...
    }

    throw error;
  }
}
```

要求：

- Provider 版本冲突最多重试一次。
- 重试前必须重新读取并比较正文哈希。
- 不能无限重试。
- 正文确实变化时继续生成冲突副本。
- 仅 mtime 变化、正文相同，可安全重试。
- 使用 `StorageWriteResult` 更新数据库，减少重复 stat。

---

## 14.3 结构化 StorageError

建议新增：

```text
src/main/storage/StorageError.ts
```

```ts
export type StorageErrorCode =
  | "VERSION_CONFLICT"
  | "FILE_BUSY"
  | "PERMISSION_DENIED"
  | "REPLACE_FAILED"
  | "IO_ERROR";

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
  }
}
```

至少应将 Provider 的版本冲突从字符串判断：

```ts
error.message.includes("外部修改")
```

改为结构化判断。

跨 IPC 暂时仍可以向用户返回友好的 message；本次不强制重构全局错误序列化协议。

---

## 15. Recovery 行为

保留现有 10 秒 Recovery 机制。

规则：

### 保存失败

```text
保留或更新 Recovery
```

### 程序异常结束

```text
下次启动按现有规则提示恢复
```

### 用户点击“保存并继续”

```text
正文保存成功
  -> DocumentService.save() 现有逻辑 discard Recovery
```

### 用户点击“不保存”

```text
显式 discard Recovery
```

### 用户点击“取消”

```text
不 discard
```

### 用户保存失败后直接强制结束进程

```text
Recovery 应存在
```

不要把 Recovery 当作“用户选择不保存”后的隐藏撤销机制。主动丢弃和异常丢失必须区分。

---

## 16. 保存状态 UI

当前顶部状态 UI 已存在，可以复用。

建议状态文案：

| 状态 | 文案 |
|---|---|
| saved | 已保存 |
| dirty | 未保存 |
| saving | 正在保存… |
| error | 保存失败 |
| conflict | 已创建冲突副本 |

冲突状态建议明确告诉用户内容已经保存到副本，而不是只显示“检测到外部修改”。

例如：

```text
外部文件已变化，当前修改已保存为冲突副本
```

保存失败 Banner：

- 展示错误摘要。
- 保留“重试”。
- 不应自动消失。
- 点击重试调用 `requestSave("retry")`。

窗口标题增强属于可选项：

```text
● 画布名称 - 画伴
```

本次可不实现，不得影响 P0 任务完成。

---

## 17. 日志

当前已有 `AppLogger`。

新增或完善以下事件：

```text
document.save.requested
document.save.started
document.save.success
document.save.failed
document.save.coalesced
document.save.conflict
document.leave.requested
document.leave.cancelled
document.leave.discarded
app.close.requested
app.close.cancelled
app.close.approved
storage.replace.started
storage.replace.restored
storage.replace.failed
```

建议字段：

```ts
{
  documentId,
  reason,
  revision,
  durationMs,
  size,
  providerType,
  errorCode
}
```

禁止记录：

- Scene 内容；
- 图片内容；
- 完整文件路径；
- 用户画布正文；
- BinaryFiles；
- 用户隐私数据。

日志中的文件路径如确需排查，应只记录相对路径或哈希，且避免默认输出。

---

## 18. 测试计划

## 18.1 保存协调器单元测试

新增：

```text
src/renderer/src/features/editor/DocumentSaveCoordinator.test.ts
```

使用 Vitest fake timers。

必须覆盖：

### 5 秒防抖

```text
修改
前进 4999ms
不保存

前进 1ms
保存一次
```

### 防抖重置

```text
第 0 秒修改
第 4 秒再次修改
第 5 秒不保存
第 9 秒保存
```

### 30 秒最大等待

```text
每 1 秒持续修改
30 秒时至少保存一次
```

### 自动保存期间继续修改

```text
revision 1 开始保存
保存尚未完成时产生 revision 2
revision 1 保存完成
继续保存 revision 2
始终最大并发数为 1
```

### 自动保存期间 Ctrl+S

```text
自动保存正在执行
Ctrl+S
不并发
最终最新 revision 已持久化
```

### 连续 Ctrl+S

```text
快速触发 10 次
最大并发为 1
不要求写 10 次
```

### 保存失败

```text
状态变为 error
dirty 保留
Recovery callback 被调用
不进入无限自动重试
```

### dispose

```text
页面卸载后 timer 不再触发保存
```

---

## 18.2 LocalStorageProvider 测试

现有：

```text
src/main/storage/LocalStorageProvider.test.ts
```

保留当前测试并新增：

### 覆盖已有文件

验证：

- 新内容完整。
- 备份文件最终不存在。
- temp 文件最终不存在。

### `rename(target, backup)` 失败

通过提取 `replaceFileSafely()` 并注入文件操作，或使用 mock 模拟：

- 原文件保持完整。
- 新文件没有部分覆盖。
- 返回 FILE_BUSY / REPLACE_FAILED。

### `rename(temp, target)` 失败

验证：

- backup 被恢复为 target。
- target 内容仍为旧完整内容。
- temp 被清理。

### 清理 backup 失败

验证：

- 新 target 完整。
- 保存结果可成功或带 warning。
- 下次写入前可清理 stale backup。

### 启动前存在中断 backup

```text
target 不存在
backup 存在
```

下一次写入或恢复函数应先恢复旧文件。

### expectedVersion 不一致

保留现有测试，并改为断言结构化错误 code。

### Windows 手工验证

自动测试无法稳定模拟 Defender、坚果云文件锁，必须保留手工测试。

---

## 18.3 DocumentService 集成测试

在：

```text
src/main/services/DocumentService.integration.test.ts
```

新增：

### 检查后外部修改

模拟：

1. 初次哈希检查通过。
2. 写入前外部改变版本。
3. Provider 抛 VERSION_CONFLICT。
4. DocumentService 重新读取。
5. 正文不同，生成冲突副本。
6. 原外部文件不被覆盖。

### 仅元数据变化

模拟：

- 文件正文相同；
- mtime/version 改变；
- 第一次 Provider 版本检查失败；
- 重新读取哈希相同；
- 重试一次后保存成功；
- 不生成冲突副本。

### Provider 写入结果

验证数据库中的：

- `fileSize`
- `modifiedAt`
- `contentHash`

来自最终写入结果。

### Recovery

验证：

- 保存成功后 Recovery 被删除。
- 用户 discard 流程由 Renderer 调用 Recovery API，必要时增加 IPC 层测试。

---

## 18.4 生命周期测试

建议将 Main 关闭状态逻辑提取为可测的纯控制器，或至少为 IPC 处理增加测试。

覆盖：

### clean 关闭

```text
Renderer 返回 proceed
窗口正常 close
```

### dirty 取消

```text
Renderer 返回 cancel
窗口保持打开
pending request 清空
再次点击关闭可以产生新 requestId
```

### 重复关闭

```text
第一次请求未决
再次点击关闭
不产生第二个并行请求
```

### 过期响应

```text
旧 requestId 响应
被忽略
```

### 保存失败

```text
Renderer 不返回 proceed
用户仍可重试或取消
Main 不 destroy
```

### 用户思考超过 5 秒

```text
窗口不会被定时销毁
```

---

## 18.5 E2E 场景

在现有 Playwright Electron E2E 中增加：

### 返回工作区时保存

1. 打开画布。
2. 修改内容。
3. 立即点击返回。
4. 出现未保存确认。
5. 点击保存并返回。
6. 重新打开，内容存在。

### 返回工作区时取消

1. 修改内容。
2. 点击返回。
3. 点击取消。
4. 仍停留在编辑器。
5. 内容仍在内存中。

### 返回工作区时不保存

1. 先保存版本 A。
2. 修改为版本 B。
3. 返回并选择不保存。
4. 重新打开。
5. 内容为版本 A。
6. 下次启动不出现版本 B 的 Recovery 提示。

### 关闭窗口时取消

1. 修改内容。
2. 点击窗口关闭。
3. 选择取消。
4. 应用仍运行。

### 关闭窗口保存并退出

1. 修改内容。
2. 关闭。
3. 选择保存并退出。
4. 重启。
5. 内容存在。

### 保存失败

可通过只读目录、模拟 Provider 错误或测试专用开关：

1. 修改内容。
2. 关闭。
3. 点击保存并退出。
4. 保存失败。
5. 应用不退出。
6. 点击取消仍可继续编辑。
7. 点击不保存后才退出。

---

## 19. Windows 手工验收矩阵

必须在 Windows 10/11 上测试打包版或开发版。

| 场景 | 预期 |
|---|---|
| 普通本地目录连续绘制 10 分钟 | 无文件损坏，无并发保存异常 |
| 坚果云同步目录 | 保存可成功；文件占用时明确失败，不损坏旧文件 |
| Defender 实时保护开启 | 保存失败可重试，旧文件完整 |
| 文件在资源管理器预览 | 不应原地部分覆盖 |
| 大画布（含图片） | UI 可继续编辑，保存队列串行 |
| 连续按 Ctrl+S | 不并发 |
| 自动保存时关闭窗口 | 等待保存或显示确认 |
| 保存失败时关闭窗口 | 不静默退出 |
| 确认框停留超过 5 秒 | 应用不被强制关闭 |
| 用户选择不保存 | 下次启动不提示被丢弃内容的 Recovery |
| 强制结束进程 | 下次启动可检测 Recovery |

---

## 20. 分阶段执行顺序

## Phase 1：保存队列与自动保存

修改：

```text
src/renderer/src/pages/EditorPage.tsx
src/renderer/src/features/editor/DocumentSaveCoordinator.ts
src/renderer/src/features/editor/saveTypes.ts
```

完成：

- 串行 drain loop。
- revision 机制。
- 5 秒防抖。
- 30 秒最大等待。
- 删除递归保存。
- 删除 blur 保存。
- 移除 250ms 初始化判断。
- 单元测试。

验收后再进入 Phase 2。

---

## Phase 2：StorageProvider 与 Windows 安全替换

修改：

```text
src/main/storage/StorageProvider.ts
src/main/storage/LocalStorageProvider.ts
src/main/storage/StorageError.ts
src/main/storage/LocalStorageProvider.test.ts
```

完成：

- WriteResult 增加 size 并明确必填字段。
- 删除 `copyFile(temp, target)` 回退。
- backup-swap-recovery。
- stale backup 恢复。
- 结构化错误。
- 失败注入测试。

---

## Phase 3：DocumentService 冲突竞态

修改：

```text
src/main/services/DocumentService.ts
src/main/services/DocumentService.integration.test.ts
```

完成：

- 正文哈希判断保留。
- Provider expectedVersion 重新接入。
- 元数据变化最多重试一次。
- 正文变化创建冲突副本。
- 直接使用 StorageWriteResult 更新数据库。

---

## Phase 4：离开画布确认

修改或新增：

```text
src/renderer/src/components/UnsavedChangesDialog.tsx
src/renderer/src/pages/EditorPage.tsx
```

完成：

- 保存并继续。
- 不保存并继续。
- 取消。
- 保存失败重试。
- 主动丢弃时 discard Recovery。
- 返回工作区与 Ctrl+W 共用流程。

---

## Phase 5：关闭协议

修改：

```text
src/shared/types.ts
src/shared/schemas.ts
src/shared/channels.ts
src/preload/index.ts
src/main/index.ts
src/main/ipc/registerIpcHandlers.ts
src/renderer/src/App.tsx
src/renderer/src/pages/EditorPage.tsx
src/renderer/src/pages/WorkspacePage.tsx
src/renderer/src/pages/SettingsPage.tsx
```

完成：

- requestId。
- proceed / cancel。
- 删除 readyToClose。
- 删除 5 秒无条件 destroy。
- 用户取消可复位。
- 服务仅在最终退出时释放。
- 关闭监听尽量集中到 App。

---

## Phase 6：E2E、文档和回归

修改：

```text
docs/reliability.md
docs/storage-provider.md
docs/testing.md
README.md
```

README 中更新：

```text
800ms 防抖自动保存
```

为：

```text
5 秒防抖自动保存、30 秒最长保存间隔、退出前未保存确认
```

更新可靠性文档中的：

- blur 保存；
- 关闭最多等待 5 秒；
- Windows 原子写入描述；
- Recovery 主动丢弃规则；
- 冲突检查流程。

---

## 21. 建议提交拆分

建议 Agent 按以下 commit 拆分：

```text
refactor(save): add serialized document save coordinator

fix(storage): make Windows file replacement crash-safe

fix(document): close external modification race during save

feat(editor): confirm unsaved changes before leaving

fix(lifecycle): make app close handshake cancellable

test(save): cover autosave close and recovery flows

docs(reliability): document Save System V2 behavior
```

不要把所有修改压在一个超大 commit 中。

---

## 22. Agent 执行约束

1. 开始修改前先重新读取目标文件，确认分支代码未变化。
2. 优先最小改动，不顺便重写工作区、数据库或 UI 架构。
3. 不引入新的状态管理库。
4. 不新增原生 Node 依赖。
5. 不删除现有冲突副本能力。
6. 不降低 Recovery 安全性。
7. 不把保存错误只写入 `console.error`。
8. 不通过 `copyFile` 原地覆盖目标文件来规避 Windows rename 问题。
9. 不使用递归 Promise 实现保存队列。
10. 不使用固定延时猜测 Excalidraw 初始化完成。
11. 不在确认框等待期间设置自动强制关闭 timeout。
12. 每个 Phase 完成后运行：

```bash
npm run typecheck
npm test
npm run lint
```

13. 最终运行：

```bash
npm run build
npm run test:e2e
```

14. 如果 better-sqlite3 导致集成测试 skip，必须在完整依赖环境中再次运行，不能把 skip 当作通过。
15. Windows 相关行为必须进行真实 Windows 手工验收，Linux CI 通过不能替代 Windows 验证。

---

## 23. 最终验收标准

### 保存串行性

- 任意时刻最多一个 `documents.save()` 正在执行。
- 自动保存、Ctrl+S、返回和关闭不会并发写文件。
- 保存期间产生的新修改最终会被继续保存。

### 自动保存

- 停止编辑 5 秒后保存。
- 持续编辑最长 30 秒保存一次。
- 保存失败不无限自动重试。
- blur 不直接触发强制保存。

### Windows 文件安全

- 保存失败时旧文件完整。
- 不存在半写入正式文件。
- temp 和 backup 可清理或可恢复。
- 文件占用时显示失败，不冒险覆盖。

### 外部修改

- 正文变化不会被静默覆盖。
- 生成冲突副本。
- 仅 mtime/元数据变化、正文相同时不会无意义生成冲突副本。
- 检查完成后发生的外部修改仍能被 Provider 版本检查捕获。

### 离开和退出

- clean：直接继续。
- dirty：显示三按钮确认。
- saving：等待完成。
- error：允许重试、不保存或取消。
- 取消关闭后应用保持可用，之后仍可再次关闭。
- 确认框停留超过 5 秒不会被强制销毁。

### Recovery

- 异常退出后可以恢复。
- 保存失败时保留 Recovery。
- 用户主动“不保存”时删除 Recovery。
- 正文保存成功后删除 Recovery。

### 代码质量

- `EditorPage` 不再包含递归保存队列。
- Provider 接口保持简洁。
- 没有新增 `backup()`、`restore()`、`lock()`、`unlock()` 公共接口。
- 新增逻辑具备单元或集成测试。
- README 和 docs 与实际行为一致。

---

## 24. 完成后的预期用户体验

```text
用户编辑
  ↓
顶部显示“未保存”
  ↓
停止 5 秒
  ↓
顶部显示“正在保存…”
  ↓
顶部显示“已保存”
```

持续编辑：

```text
持续绘制
  ↓
30 秒保存一次当前快照
  ↓
编辑不中断
  ↓
后续修改继续串行保存
```

离开时：

```text
存在未保存内容
  ↓
保存并继续 / 不保存 / 取消
```

关闭时：

```text
存在未保存内容
  ↓
用户可以思考和选择
  ↓
应用不会在固定 5 秒后强制销毁
```

保存失败：

```text
旧文件保持完整
  ↓
保留 Recovery
  ↓
提示重试、丢弃或取消
```

该方案完成后，CanvasDesk 的保存系统才具备可靠桌面编辑器应有的基本语义，并能作为未来本地缓存、坚果云同步目录、OSS、WebDAV 和多画布 Tab 的稳定基础。
