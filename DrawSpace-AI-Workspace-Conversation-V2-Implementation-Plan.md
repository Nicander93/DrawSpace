# DrawSpace AI 工作区会话与多模态生成 V2 实施文档

> 仓库：`Nicander93/DrawSpace`  
> 基线：2026-08-02 `main` 分支，AI Mermaid V1 已完成初步接入  
> 前置文档：`DrawSpace-AI-Mermaid-V1-Implementation-Plan.md`  
> 目标读者：能力一般或偏弱的 Coding Agent  
> 核心原则：小步实施、每阶段可运行、不得一次性重写现有编辑器与保存体系

---

## 1. 文档目的

DrawSpace 当前已经实现第一版 AI 图表生成：

```text
自然语言
  → OpenAI-Compatible 模型
  → Mermaid
  → Excalidraw 元素
  → 预览
  → 插入画布
```

目前实现能够完成基本闭环，但仍是一次性弹窗式工具：

- AI 入口位于 navbar / 编辑器顶部栏；
- 关闭弹窗后输入、Mermaid 和预览会丢失；
- 没有工作区级历史对话；
- 不支持新建、切换、重命名和删除对话；
- 不支持上传或粘贴截图；
- 选区上下文只实现了较简单的文本和箭头摘要；
- 多轮修改和历史结果复用能力不足。

本次升级的目标不是把 DrawSpace 变成通用聊天软件，而是把 AI 功能升级成：

> **面向图表生成、图表补充和画布协作的工作区级 AI 会话面板。**

---

## 2. 本次最终产品形态

### 2.1 画布内 AI 入口

删除 navbar 和编辑器顶部栏中的文字按钮。

在画布内部显示一个仅包含图标的悬浮按钮：

```text
┌──────────────────────────────────────────────┐
│ Excalidraw 画布                         [✨] │
│                                              │
│                 当前画布                     │
│                                              │
└──────────────────────────────────────────────┘
```

要求：

- 默认只显示 `Sparkles` 图标；
- 不显示“AI”“AI 生成”等文字；
- 使用 `title` 和 `aria-label` 提供说明；
- 鼠标悬停后显示原生或自定义 Tooltip；
- 面板打开时按钮显示激活状态；
- 固定在画布视口中，不随画布平移和缩放；
- 不直接修改 Excalidraw 内部 DOM；
- 作为 `.editor-canvas` 的覆盖层实现。

建议按钮：

```tsx
<button
  className={`canvas-ai-trigger ${panelOpen ? "is-active" : ""}`}
  type="button"
  title="打开 AI 图表助手"
  aria-label="打开 AI 图表助手"
  aria-pressed={panelOpen}
  onClick={onOpenAi}
>
  <Sparkles size={17} />
</button>
```

### 2.2 工作区级右侧面板

点击图标后，不再打开居中的大弹窗，而是在画布右侧打开工作区级面板：

```text
┌──────────────────────────────┬──────────────────────────────┐
│                              │ AI 图表助手                   │
│                              ├──────────┬───────────────────┤
│                              │ 对话列表 │ 当前对话            │
│          当前画布            │          │                     │
│                              │ 新建对话 │ 历史消息 / 图表预览  │
│                              │ 历史会话 │                     │
│                              │          ├───────────────────┤
│                              │          │ 输入框 / 附件 / 发送 │
└──────────────────────────────┴──────────┴───────────────────┘
```

面板要求：

- 面板属于当前工作区，而不是某一张画布；
- 切换标签页时面板保持打开；
- 左侧显示工作区内的历史对话；
- 右侧显示当前对话；
- 支持新建对话；
- 关闭面板后再次打开，恢复上次选中的对话和输入草稿；
- 应用重启后，历史对话仍然存在；
- 当前画布改变时，插入目标随当前活动画布改变；
- 会话来源画布和当前插入目标必须清楚区分。

---

## 3. 明确的产品决策

### 3.1 会话属于工作区

每个 AI 会话必须关联：

```text
workspaceId
```

可选关联：

```text
sourceDocumentId
```

含义：

- 会话属于整个工作区；
- 创建会话时可以记录来源画布；
- 用户切换到其他画布后仍可继续该会话；
- 点击“插入画布”时，默认插入当前活动画布；
- 如果来源画布与当前画布不同，界面显示提示。

示例：

```text
来源画布：Electron 架构草图
当前插入目标：系统设计
```

### 3.2 不把完整聊天记录全部发送给模型

界面可以展示完整历史，但模型调用应采用“最小必要上下文”。

普通新生成：

```text
当前用户输入
+ 当前明确选择的选区上下文
+ 当前明确添加的截图
```

基于历史结果修改：

```text
指定历史轮次中的 Mermaid
+ 当前修改要求
+ 可选的新选区或截图
```

不要默认把整个会话的所有消息发送给本地模型。

原因：

- 小模型上下文能力有限；
- 旧内容可能干扰当前生成；
- Token 开销更高；
- Mermaid 修改任务只需要基准 Mermaid 和当前要求。

### 3.3 Mermaid 仍是 V2 的主要中间格式

V2 保留当前主链路：

```text
文本 / 截图 / 选区
       ↓
视觉或文本模型
       ↓
Mermaid
       ↓
Excalidraw
```

本次不直接让模型输出完整 Excalidraw JSON。

### 3.4 对话历史保存 Mermaid，不保存转换结果

持久化内容：

- 用户提示词；
- Mermaid 源码；
- 生成状态；
- 简短错误信息；
- 使用的模型；
- 选区上下文快照；
- 截图附件元数据；
- 插入记录；
- 对话标题和草稿。

不要持久化：

- SVG 预览字符串；
- Blob URL；
- 转换后的完整 Excalidraw 元素；
- 完整模型原始响应；
- 超长错误堆栈。

重新打开历史记录时，根据 Mermaid 重新转换并生成预览。

---

## 4. 当前代码问题：必须先修复

在实现会话系统前，先修复现有 V1 的关键缺陷。

### 4.1 Mermaid 解析失败后无法使用“AI 修复”

当前 `AiDiagramDialog` 的 `convert()` 只有转换成功后才执行：

```ts
setMermaid(source);
```

因此首次转换失败时：

- Mermaid 源码没有进入状态；
- “查看 Mermaid”按钮不出现；
- “AI 修复”按钮不出现。

修复要求：

```ts
const result = await window.desktopApi.ai.generateMermaid(...);

setMermaid(result.mermaid);
setDiagram(null);
setParseError(null);

await convert(result.mermaid);
```

`convert()` 不再负责首次保存 Mermaid，只负责转换。

### 4.2 新请求失败后旧结果仍可能保留

开始重新生成、修复或切换会话时，必须清理旧的临时结果：

```ts
setDiagram(null);
setPreviewUrl(null);
setParseError(null);
```

不得出现：

```text
新请求失败
→ 仍显示旧预览
→ 旧结果仍可点击插入
```

### 4.3 选区摘要存在重复节点和错误标签

当前 `SelectionContextExtractor` 需要修复：

1. 形状和绑定文本同时选中时，不得生成两个节点；
2. 箭头标签应读取绑定文本元素，而不是 `arrow.text`；
3. 无文字形状不得把 Excalidraw UUID 作为模型可见标签；
4. 每段文字必须先截断到 500 字符；
5. 正方形或分散布局不能一律判定为横向；
6. 返回真实选中数量和实际纳入数量；
7. 给模型的节点 ID 使用 `N1、N2、N3` 等短别名；
8. 原始 Excalidraw ID 仅保留在本地快照，不发送给模型。

### 4.4 Mermaid 转换结果缺少上限

`MermaidDiagramAdapter` 必须增加：

```ts
const elements = convertToExcalidrawElements(result.elements, {
  regenerateIds: true
});

if (elements.length === 0) {
  throw new Error("生成的图表不包含任何元素");
}

if (elements.length > 500) {
  throw new Error("生成的图表元素过多，请缩小需求范围");
}
```

同时限制：

```text
maxEdges <= 200
maxTextSize <= 20,000
```

不要继续使用当前偏宽松的 300 条边和 50,000 字符。

### 4.5 插入错误不能污染保存错误状态

当前插入 AI 图表失败时使用 `setSaveError()`，会让用户误以为文档保存失败。

新增独立状态：

```ts
const [aiInsertError, setAiInsertError] = useState<string | null>(null);
```

或者由 AI 面板自身展示插入错误。

### 4.6 统一包管理器和锁文件

当前项目 README 和 CI 使用 npm。

要求：

- 保留 `package-lock.json`；
- 删除 `pnpm-lock.yaml`；
- 使用 `npm ci` 验证；
- 不允许两个锁文件继续产生不同版本。

---

## 5. 本次范围

### 5.1 必须实现

- 画布内仅图标 AI 入口；
- 移除 navbar / topbar AI 文字按钮；
- 工作区级右侧 AI 面板；
- 左侧历史对话列表；
- 新建、切换、重命名、删除对话；
- 对话按工作区隔离；
- 关闭面板后状态不丢失；
- 应用重启后历史记录仍存在；
- 当前输入草稿持久化；
- 每轮保存提示词、Mermaid、错误和插入状态；
- 支持基于某次 Mermaid 继续修改；
- 改进选区上下文；
- 支持上传、拖拽和粘贴一张截图；
- 支持截图 + 用户要求生成 Mermaid；
- 支持选区摘要与截图同时作为上下文；
- 保留现有 Mermaid 预览和插入能力；
- 完整类型、Zod、IPC 和单元测试。

### 5.2 暂不实现

- 通用聊天问答；
- 全量聊天历史自动发送给模型；
- 流式 Token 渲染；
- 多 Agent；
- MCP；
- AI 直接自由修改任意现有元素；
- AI 直接生成 Excalidraw JSON；
- 分支式会话树；
- 会话全文搜索；
- 云端同步 AI 历史；
- 多张大图同时上传；
- OCR 独立服务；
- API Key 安全存储；
- 跨工作区共享会话。

---

## 6. 推荐代码结构

新增：

```text
src/main/database/
  AiConversationRepository.ts
  aiConversationMigration.ts

src/main/services/ai/
  AiConversationService.ts
  AiAttachmentService.ts
  AiPromptBuilder.ts
  AiGenerationCoordinator.ts
  imageValidation.ts

src/main/ipc/
  aiConversationHandlers.ts

src/renderer/src/features/ai/
  AiWorkspacePanel.tsx
  AiConversationSidebar.tsx
  AiConversationView.tsx
  AiTurnCard.tsx
  AiComposer.tsx
  AiAttachmentBar.tsx
  AiCanvasTrigger.tsx
  AiContextPreview.tsx
  AiCanvasBridge.ts
  aiConversationStore.ts
  SelectionContextExtractor.ts
  SelectionImageExporter.ts
  MermaidDiagramAdapter.ts
  DiagramPlacement.ts
```

修改：

```text
src/main/index.ts
src/main/database/DatabaseService.ts
src/main/services/ai/AiDiagramService.ts
src/main/services/ai/OpenAiCompatibleClient.ts
src/main/ipc/registerIpcHandlers.ts
src/preload/index.ts

src/shared/channels.ts
src/shared/schemas.ts
src/shared/types.ts

src/renderer/src/pages/EditorWorkspacePage.tsx
src/renderer/src/pages/EditorPage.tsx
src/renderer/src/pages/SettingsPage.tsx
src/renderer/src/styles/global.css
```

测试：

```text
tests/unit/ai/AiConversationRepository.test.ts
tests/unit/ai/AiConversationService.test.ts
tests/unit/ai/AiAttachmentService.test.ts
tests/unit/ai/AiPromptBuilder.test.ts
tests/unit/ai/SelectionContextExtractor.test.ts
tests/unit/ai/MermaidDiagramAdapter.test.ts
tests/unit/ai/imageValidation.test.ts
```

---

## 7. 数据库设计

当前项目使用 `better-sqlite3`，数据库连接由 `DatabaseService` 私有持有。

不要为了 AI 功能公开原始数据库连接。

推荐做法：

```ts
export class DatabaseService {
  private readonly database: Database.Database;

  readonly aiConversations: AiConversationRepository;

  constructor(databasePath: string) {
    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");

    this.migrate();
    this.aiConversations = new AiConversationRepository(this.database);
  }
}
```

### 7.1 `ai_sessions`

```sql
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_document_id TEXT,
  title TEXT NOT NULL,
  draft_prompt TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY(workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY(source_document_id)
    REFERENCES documents(id)
    ON DELETE SET NULL
);
```

### 7.2 `ai_turns`

一轮包含一次用户要求及其对应 AI 结果，不需要拆成通用 message 表。

```sql
CREATE TABLE IF NOT EXISTS ai_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  base_turn_id TEXT,
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  context_json TEXT,
  status TEXT NOT NULL,
  mermaid TEXT,
  error_message TEXT,
  model_name TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  inserted_document_id TEXT,
  inserted_at INTEGER,
  FOREIGN KEY(session_id)
    REFERENCES ai_sessions(id)
    ON DELETE CASCADE,
  FOREIGN KEY(base_turn_id)
    REFERENCES ai_turns(id)
    ON DELETE SET NULL,
  FOREIGN KEY(inserted_document_id)
    REFERENCES documents(id)
    ON DELETE SET NULL
);
```

`mode` 允许：

```text
create
revise
recreate_image
reference_image
extend_selection
```

`status` 允许：

```text
generating
ready
error
cancelled
```

### 7.3 `ai_attachments`

```sql
CREATE TABLE IF NOT EXISTS ai_attachments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id)
    REFERENCES ai_sessions(id)
    ON DELETE CASCADE,
  FOREIGN KEY(turn_id)
    REFERENCES ai_turns(id)
    ON DELETE CASCADE
);
```

`kind` 允许：

```text
uploaded_image
selection_preview
```

### 7.4 索引

```sql
CREATE INDEX IF NOT EXISTS idx_ai_sessions_workspace_updated
  ON ai_sessions(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_turns_session_created
  ON ai_turns(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_attachments_turn
  ON ai_attachments(turn_id);
```

### 7.5 迁移方式

不要在本次任务中重构全部数据库迁移体系。

新增：

```ts
export function applyAiConversationMigration(
  database: Database.Database
): void
```

然后在当前 `DatabaseService.migrate()` 中调用。

---

## 8. 共享类型

在 `src/shared/types.ts` 增加：

```ts
export type AiTurnMode =
  | "create"
  | "revise"
  | "recreate_image"
  | "reference_image"
  | "extend_selection";

export type AiTurnStatus =
  | "generating"
  | "ready"
  | "error"
  | "cancelled";

export interface AiSessionSummary {
  id: string;
  workspaceId: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  title: string;
  draftPrompt: string;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  latestTurnStatus?: AiTurnStatus;
  latestPrompt?: string;
}

export interface AiAttachment {
  id: string;
  sessionId: string;
  turnId?: string;
  kind: "uploaded_image" | "selection_preview";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface AiContextSnapshot {
  documentId?: string;
  documentName?: string;
  selection?: AiSelectionContext;
  attachmentIds: string[];
  capturedAt: number;
}

export interface AiTurn {
  id: string;
  sessionId: string;
  baseTurnId?: string;
  mode: AiTurnMode;
  prompt: string;
  context?: AiContextSnapshot;
  status: AiTurnStatus;
  mermaid?: string;
  errorMessage?: string;
  modelName?: string;
  createdAt: number;
  completedAt?: number;
  insertedDocumentId?: string;
  insertedAt?: number;
  attachments: AiAttachment[];
}

export interface AiSessionDetail extends AiSessionSummary {
  turns: AiTurn[];
}
```

### 8.1 图片 IPC 输入

```ts
export interface AiImageUpload {
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: ArrayBuffer;
}
```

不要允许 Renderer 传入任意本地路径。

### 8.2 创建与更新请求

```ts
export interface CreateAiSessionRequest {
  workspaceId: string;
  sourceDocumentId?: string;
  title?: string;
}

export interface UpdateAiSessionRequest {
  sessionId: string;
  title?: string;
  draftPrompt?: string;
}

export interface GenerateAiTurnRequest {
  sessionId: string;
  prompt: string;
  mode: AiTurnMode;
  baseTurnId?: string;
  selection?: AiSelectionContext;
  images?: AiImageUpload[];
}
```

---

## 9. Zod 校验

在 `src/shared/schemas.ts` 中增加完整校验。

关键限制：

```ts
const aiImageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  mimeType: z.enum([
    "image/png",
    "image/jpeg",
    "image/webp"
  ]),
  data: z.instanceof(ArrayBuffer).refine(
    (value) => value.byteLength > 0 &&
      value.byteLength <= 8 * 1024 * 1024,
    "单张图片不能超过 8 MB"
  )
});

export const generateAiTurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(10_000),
  mode: z.enum([
    "create",
    "revise",
    "recreate_image",
    "reference_image",
    "extend_selection"
  ]),
  baseTurnId: z.string().uuid().optional(),
  selection: aiSelectionContextSchema.optional(),
  images: z.array(aiImageUploadSchema).max(1).optional()
});
```

服务层必须再次校验，不得只依赖 Renderer。

---

## 10. Repository 设计

`AiConversationRepository` 只负责 SQLite CRUD，不调用模型、不处理图片文件。

接口建议：

```ts
export class AiConversationRepository {
  constructor(private readonly database: Database.Database) {}

  createSession(input: {
    workspaceId: string;
    sourceDocumentId?: string;
    title: string;
  }): AiSessionSummary;

  listSessions(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
      documentId?: string;
    }
  ): AiSessionSummary[];

  getSession(sessionId: string): AiSessionDetail | null;

  renameSession(
    sessionId: string,
    title: string
  ): AiSessionSummary;

  updateDraft(
    sessionId: string,
    draftPrompt: string
  ): void;

  deleteSession(sessionId: string): void;

  createTurn(input: {
    sessionId: string;
    baseTurnId?: string;
    mode: AiTurnMode;
    prompt: string;
    contextJson?: string;
    modelName?: string;
  }): AiTurn;

  completeTurn(
    turnId: string,
    mermaid: string,
    completedAt: number
  ): void;

  failTurn(
    turnId: string,
    message: string,
    completedAt: number
  ): void;

  cancelTurn(turnId: string): void;

  markTurnInserted(
    turnId: string,
    documentId: string,
    insertedAt: number
  ): void;

  addAttachment(...): AiAttachment;

  markInterruptedTurns(): number;
}
```

### 10.1 事务要求

生成开始前，在一个事务中：

1. 创建 turn；
2. 更新 session `updated_at`；
3. 清空或更新 `draft_prompt`。

生成成功后，在一个事务中：

1. 更新 turn 状态；
2. 保存 Mermaid；
3. 更新时间；
4. 更新 session `updated_at`。

### 10.2 应用异常退出

应用启动时调用：

```ts
repository.markInterruptedTurns();
```

将遗留的：

```text
status = generating
```

改为：

```text
status = error
error_message = "应用退出或生成过程被中断"
```

---

## 11. 附件服务

新增：

```text
src/main/services/ai/AiAttachmentService.ts
```

附件保存目录：

```text
<userData>/ai-attachments/
  <workspaceId>/
    <sessionId>/
      <attachmentId>.png
```

职责：

```ts
saveUploadedImage(...)
readAttachmentDataUrl(...)
deleteSessionAttachments(...)
validateImage(...)
```

### 11.1 安全要求

必须校验：

- MIME 只允许 PNG、JPEG、WEBP；
- 最大 8 MB；
- 最多一张；
- 文件头与 MIME 大致匹配；
- 不接受 SVG；
- 不接受路径；
- 文件名只用于展示，不参与最终磁盘路径；
- 最终磁盘文件名使用 UUID；
- 日志不得记录图片内容或 Data URL。

### 11.2 压缩策略

V2 第一阶段允许先不引入图片处理依赖。

但应预留：

```text
最长边压缩到 2048px
```

如果当前项目不希望增加 `sharp` 等原生依赖，第一版只做大小限制，并把压缩列为后续任务。

---

## 12. 多模态模型消息

当前 `ChatMessage.content` 只支持字符串，需扩展：

```ts
export type ChatContent =
  | string
  | Array<
      | {
          type: "text";
          text: string;
        }
      | {
          type: "image_url";
          image_url: {
            url: string;
          };
        }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}
```

图片在主进程转换为：

```text
data:image/png;base64,...
```

Renderer 不负责构造 Data URL。

### 12.1 AI 设置扩展

```ts
export interface AiSettings {
  baseUrl: string;
  model: string;
  visionModel?: string;
  temperature: number;
  timeoutMs: number;
}
```

规则：

```text
普通文本生成 → model
带截图生成 → visionModel || model
Mermaid 修复 → model
```

设置页字段：

```text
文本模型
视觉模型（可选）
```

提示：

```text
视觉模型留空时，截图生成将使用文本模型。
如果模型不支持图片，生成会失败。
```

---

## 13. Prompt 模式

新增：

```text
src/main/services/ai/AiPromptBuilder.ts
```

不要继续把所有 Prompt 拼接逻辑堆在 `AiDiagramService` 中。

### 13.1 `create`

```text
用户需求：
{prompt}

请生成一份完整、简洁且有效的 Mermaid。
```

### 13.2 `revise`

必须存在 `baseTurnId`，并读取该轮 Mermaid：

```text
下面是当前图表 Mermaid：

{baseMermaid}

用户修改要求：
{prompt}

请输出修改后的完整 Mermaid。
不要只输出差异。
```

### 13.3 `recreate_image`

```text
请理解图片中的图表结构，并重新生成可编辑 Mermaid。

用户补充要求：
{prompt}

要求：
- 保留主要节点和关系；
- 忽略图片中的装饰性背景；
- 不要输出解释；
- 只输出 Mermaid。
```

### 13.4 `reference_image`

```text
图片仅作为布局或内容参考。

用户需求：
{prompt}

请根据用户需求生成 Mermaid，不必逐像素复刻图片。
```

### 13.5 `extend_selection`

```text
当前选区结构摘要：
{selection.summary}

节点：
{nodes}

关系：
{edges}

用户需求：
{prompt}

只生成需要新增的内容，不要重复当前选区。
```

必须在产品说明中明确：

> V2 的“参考选区扩展”仍会生成独立的新图表，不保证自动连接到原有元素。

真正跨新旧元素绑定属于后续 `DiagramPatch` 能力。

---

## 14. 会话服务

新增：

```text
src/main/services/ai/AiConversationService.ts
```

职责：

- 创建和读取会话；
- 更新草稿；
- 管理附件；
- 创建生成记录；
- 选择文本或视觉模型；
- 调用 PromptBuilder；
- 调用 OpenAI-Compatible Client；
- 提取 Mermaid；
- 保存成功或失败状态；
- 标记插入记录。

建议接口：

```ts
export class AiConversationService {
  constructor(
    private readonly repository: AiConversationRepository,
    private readonly settingsService: AiSettingsService,
    private readonly client: OpenAiCompatibleClient,
    private readonly attachmentService: AiAttachmentService,
    private readonly promptBuilder: AiPromptBuilder,
    private readonly logger?: AppLogger
  ) {}

  listSessions(...): Promise<AiSessionSummary[]>;
  createSession(...): Promise<AiSessionSummary>;
  getSession(sessionId: string): Promise<AiSessionDetail>;
  updateSession(...): Promise<AiSessionSummary>;
  deleteSession(sessionId: string): Promise<void>;

  generateTurn(
    request: GenerateAiTurnRequest
  ): Promise<AiTurn>;

  repairTurn(...): Promise<AiTurn>;
  markInserted(...): Promise<void>;
}
```

### 14.1 会话标题

新建空白会话默认：

```text
新对话
```

首次发送时，如果标题仍是“新对话”，使用提示词前 24～32 个字符生成标题。

不要额外调用模型生成标题。

### 14.2 并发限制

同一个 session 同时只允许一个 `generating` turn。

如果用户重复发送：

```text
当前对话正在生成，请等待完成或取消
```

不同 session 可以并发，但建议全局最多 2 个，避免本地模型被压垮。

---

## 15. IPC 设计

在 `src/shared/channels.ts` 增加：

```ts
aiListSessions: "ai:list-sessions",
aiCreateSession: "ai:create-session",
aiGetSession: "ai:get-session",
aiUpdateSession: "ai:update-session",
aiDeleteSession: "ai:delete-session",

aiGenerateTurn: "ai:generate-turn",
aiRepairTurn: "ai:repair-turn",
aiMarkTurnInserted: "ai:mark-turn-inserted",
```

必要时保留旧接口作为兼容层：

```text
ai:generate-mermaid
ai:repair-mermaid
```

但新 UI 不再直接调用旧接口。

新增：

```text
src/main/ipc/aiConversationHandlers.ts
```

不要继续扩大 `aiHandlers.ts` 单文件职责。

---

## 16. Preload API

在 `DesktopApi.ai` 中增加：

```ts
ai: {
  getSettings(): Promise<AiSettings>;
  saveSettings(settings: AiSettings): Promise<AiSettings>;
  testConnection(settings?: AiSettings): Promise<AiConnectionTestResult>;

  listSessions(
    workspaceId: string
  ): Promise<AiSessionSummary[]>;

  createSession(
    request: CreateAiSessionRequest
  ): Promise<AiSessionSummary>;

  getSession(
    sessionId: string
  ): Promise<AiSessionDetail>;

  updateSession(
    request: UpdateAiSessionRequest
  ): Promise<AiSessionSummary>;

  deleteSession(
    sessionId: string
  ): Promise<void>;

  generateTurn(
    request: GenerateAiTurnRequest
  ): Promise<AiTurn>;

  repairTurn(
    request: RepairAiTurnRequest
  ): Promise<AiTurn>;

  markTurnInserted(
    turnId: string,
    documentId: string
  ): Promise<void>;
};
```

仍然禁止暴露通用 `ipcRenderer.invoke(channel)`。

---

## 17. Renderer 状态归属

### 17.1 持久状态

由主进程 SQLite 保存：

- sessions；
- turns；
- Mermaid；
- draftPrompt；
- attachment metadata；
- 插入记录。

### 17.2 临时 UI 状态

由 Zustand 保存：

```ts
interface AiConversationUiState {
  panelOpen: boolean;
  activeSessionId?: string;
  loadingSessionIds: Record<string, boolean>;
  selectedBaseTurnId?: string;
  pendingSelectionEnabled: boolean;
  pendingSelectionPreviewEnabled: boolean;
  pendingImages: PendingImage[];
  panelWidth: number;
}
```

### 17.3 不要把持久数据只放 Zustand

禁止仅在 Renderer 中保存：

```text
sessionsByWorkspace
turn history
Mermaid history
```

否则应用重启后会丢失。

Zustand 可以缓存服务器返回的数据，但 SQLite 是事实来源。

---

## 18. 工作区级面板必须由 `EditorWorkspacePage` 持有

这是本次实现的关键。

不要继续把完整 AI 面板放在每个 `EditorPage` 中。

原因：

- 会话属于工作区；
- 多标签切换时面板不能丢失；
- 隐藏的 EditorPage 不应各自渲染一个 AI 面板；
- 工作区级会话列表只应存在一份。

结构：

```tsx
<div className="editor-workspace">
  <EditorWorkspaceTitlebar />

  <div className="editor-workbench">
    <div className="editor-document-host">
      {tabs.map((tab) => (
        <EditorPage
          ...
          onOpenAi={() => setAiPanelOpen(true)}
          registerAiBridge={registerAiBridge}
        />
      ))}
    </div>

    <AiWorkspacePanel
      open={aiPanelOpen}
      workspaceId={workspace.id}
      activeDocument={activeDocument}
      activeBridge={activeAiBridge}
      onClose={() => setAiPanelOpen(false)}
    />
  </div>
</div>
```

---

## 19. `AiCanvasBridge`

父级面板需要访问活动画布，但不能直接持有 Excalidraw API。

新增：

```text
src/renderer/src/features/ai/AiCanvasBridge.ts
```

```ts
export interface AiCanvasBridge {
  documentId: string;

  getSelectionContext():
    | AiSelectionContext
    | undefined;

  exportSelectionPreview?():
    Promise<AiImageUpload | undefined>;

  insertDiagram(
    diagram: ConvertedMermaidDiagram
  ): void;
}
```

`EditorPage` 注册：

```ts
interface EditorPageProps {
  ...
  onOpenAi?: () => void;
  registerAiBridge?: (
    documentId: string,
    bridge: AiCanvasBridge
  ) => () => void;
}
```

`EditorWorkspacePage` 保存：

```ts
const aiBridgesRef =
  useRef(new Map<string, AiCanvasBridge>());
```

活动桥接：

```ts
const activeAiBridge = activeDocumentId
  ? aiBridgesRef.current.get(activeDocumentId)
  : undefined;
```

### 19.1 读取选区的时机

不要在打开面板时永久缓存选区。

点击发送时读取：

```text
当前活动画布
→ 当前选区
→ 生成上下文快照
```

这样用户打开面板后仍可继续调整选择。

---

## 20. 画布 AI 图标接入

### 20.1 删除现有入口

从以下位置移除 AI 文字按钮：

```text
EditorWorkspacePage titlebar
EditorPage topbar
```

删除：

```text
drawspace:open-ai
```

相关 window event 监听和派发。

不要继续保留重复入口。

### 20.2 新入口

在 `.editor-canvas` 中：

```tsx
<div className="editor-canvas">
  <Excalidraw ... />

  <AiCanvasTrigger
    active={aiPanelOpen}
    onClick={onOpenAi}
  />
</div>
```

### 20.3 CSS

```css
.editor-canvas {
  position: relative;
}

.canvas-ai-trigger {
  position: absolute;
  z-index: 12;
  top: 12px;
  right: 12px;

  width: 34px;
  height: 34px;

  display: grid;
  place-items: center;

  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--muted-strong);
  background: color-mix(
    in srgb,
    var(--surface-strong) 92%,
    transparent
  );
  box-shadow: 0 4px 14px rgb(0 0 0 / 8%);
  backdrop-filter: blur(6px);
}

.canvas-ai-trigger:hover,
.canvas-ai-trigger.is-active {
  color: var(--ink);
  border-color: var(--blue);
  background: var(--surface-strong);
}
```

### 20.4 注意 Excalidraw 原生控件

不得使用选择器去修改：

```text
.excalidraw .某个内部 class
```

如果右上角与当前 Excalidraw 控件重叠：

1. 优先调整按钮自身 `top/right`；
2. 其次放到右侧中上区域；
3. 必须手动测试浅色、深色和不同窗口宽度；
4. 不依赖 Excalidraw 私有 DOM 结构。

---

## 21. 面板布局

建议默认宽度：

```text
620px
```

允许范围：

```text
520px ～ 760px
```

面板内部：

```text
会话列表：210px
当前会话：剩余空间
```

CSS 结构：

```css
.editor-workbench {
  min-height: 0;
  flex: 1;
  display: flex;
}

.editor-document-host {
  min-width: 0;
  flex: 1;
}

.ai-workspace-panel {
  width: 620px;
  min-width: 520px;
  max-width: 760px;
  flex: none;
  border-left: 1px solid var(--line);
  background: var(--surface);
}
```

### 21.1 小窗口

当可用宽度不足时：

- 会话列表折叠为窄栏或顶部下拉；
- 面板最小宽度可降到 440px；
- 不要让画布完全消失；
- 暂不需要实现移动端布局。

### 21.2 关闭行为

关闭面板：

- 不删除会话；
- 不清空草稿；
- 不清空附件草稿，除非用户主动移除；
- 可以释放 SVG Object URL；
- 重新打开时恢复最后活动会话。

---

## 22. 左侧会话列表

结构：

```text
AI 图表助手
[ + 新建对话 ]

当前画布
- 登录流程补充
- 权限系统时序图

工作区其他对话
- Electron 进程通信
- AI 设置页结构
```

### 22.1 排序

```text
updatedAt DESC
```

### 22.2 会话项展示

每项显示：

- 标题；
- 最近提示词摘要；
- 更新时间；
- 来源画布名；
- 最新状态图标。

状态：

```text
生成中
已完成
失败
```

### 22.3 操作

右键或 `...` 菜单：

```text
重命名
删除
```

删除需要确认。

### 22.4 新建对话

点击后：

1. 创建 session；
2. 关联当前 workspace；
3. `sourceDocumentId = 当前活动画布 ID`；
4. 标题为“新对话”；
5. 自动切换；
6. 聚焦输入框。

---

## 23. 当前会话内容

每个 `AiTurnCard` 展示：

```text
用户要求
上下文标签
生成状态
Mermaid 图表预览
错误信息
操作按钮
```

上下文标签示例：

```text
[选区 7 个元素]
[截图 1 张]
[来源：系统设计.excalidraw]
```

操作：

```text
插入当前画布
查看 Mermaid
基于此修改
重新生成
AI 修复
```

### 23.1 基于此修改

点击：

```text
基于此修改
```

后：

- 设置 `selectedBaseTurnId`；
- 输入框上方出现：

```text
正在基于“登录流程图 · 第 2 次结果”修改  ×
```

发送时：

```text
mode = revise
baseTurnId = 对应 turn
```

### 23.2 插入历史结果

历史中的 `ready` turn 可以随时重新转换并插入当前画布。

插入成功后：

```ts
window.desktopApi.ai.markTurnInserted(
  turn.id,
  activeDocumentId
);
```

界面显示：

```text
已插入：系统设计
```

允许再次插入，不要禁止。

---

## 24. 输入区

输入区包含：

```text
[基于某次结果修改 ×]
[当前选区 5 个 ×]
[截图 example.png ×]

[描述要生成或修改的内容……]

[添加截图] [参考选区]              [发送]
```

### 24.1 快捷键

```text
Ctrl/Cmd + Enter → 发送
Enter → 换行
Esc → 关闭浮层菜单，不直接删除草稿
```

### 24.2 选区上下文

“参考选区”默认行为：

- 当前无选区：按钮禁用；
- 当前有选区：点击后显示附件 Chip；
- 发送前再次读取最新选区；
- 用户可展开查看将发送的摘要；
- 默认只发送结构摘要；
- 可选“同时参考选区外观”后，再导出选区图片。

### 24.3 截图入口

支持：

- 点击选择文件；
- 拖入输入区；
- 从剪贴板粘贴图片。

限制：

- V2 最多一张；
- PNG/JPEG/WEBP；
- 8 MB；
- 不接受 SVG；
- 图片作为明确附件显示；
- 用户发送前可以移除。

---

## 25. 选区上下文 V2

建议类型：

```ts
export interface AiSelectionNode {
  alias: string;
  sourceElementId: string;
  label: string;
  elementType: string;
}

export interface AiSelectionEdge {
  fromAlias?: string;
  toAlias?: string;
  label?: string;
}

export interface AiSelectionContext {
  summary: string;
  nodes: AiSelectionNode[];
  edges: AiSelectionEdge[];
  selectedElementCount: number;
  includedElementCount: number;
  truncated: boolean;
  layout: "horizontal" | "vertical" | "free";
}
```

IPC 前转换为模型可见结构时，不发送：

```text
sourceElementId
```

### 25.1 节点规则

- rectangle / ellipse / diamond / frame → 一个节点；
- 查找绑定文本；
- 绑定文本本身不再单独生成节点；
- 独立 text 才生成独立节点；
- 无标签时 label 为空；
- 每个 label 最大 500 字符；
- 最多 50 个节点。

### 25.2 边规则

- 仅处理 arrow；
- line 默认不认为是语义关系；
- 查找箭头绑定文本；
- 起止元素必须映射到节点别名；
- 最多 100 条边。

### 25.3 布局判断

```ts
const horizontalRatio = width / Math.max(height, 1);

if (horizontalRatio >= 1.5) {
  layout = "horizontal";
} else if (horizontalRatio <= 0.67) {
  layout = "vertical";
} else {
  layout = "free";
}
```

---

## 26. 选区图片导出

新增：

```text
SelectionImageExporter.ts
```

使用 Excalidraw 公开导出 API，仅导出选中元素。

要求：

- 不修改画布；
- 不把导出图片加入当前画布文件；
- PNG 背景可透明或浅色；
- 最长边建议不超过 2048px；
- 导出失败时仍可只发送结构摘要；
- 明确显示是否附带选区图片。

---

## 27. 生成流程

### 27.1 用户发送

```text
1. 校验 prompt
2. 读取当前会话
3. 读取当前活动画布选区
4. 保存截图附件
5. 在 SQLite 创建 generating turn
6. UI 立即显示生成中
7. 主进程调用模型
8. 提取 Mermaid
9. 保存 turn = ready
10. Renderer 刷新当前会话
11. 转换 Mermaid 并显示预览
```

### 27.2 失败

```text
1. 保存 error_message
2. turn.status = error
3. 保留 prompt 和附件
4. UI 显示重试 / AI 修复
```

### 27.3 面板关闭期间

模型请求仍由主进程继续。

面板重新打开时，从 SQLite 读取最终状态。

不要让生成状态只依赖已卸载 React 组件中的 Promise。

---

## 28. Mermaid 预览缓存

历史会话可能有很多 Mermaid，不能一次性全部转换。

策略：

- 只转换视口附近或展开的 turn；
- 使用内存 Map 缓存：

```ts
Map<turnId, ConvertedMermaidDiagram>
```

- 会话切换时可保留少量 LRU 缓存；
- 不写入 SQLite；
- Object URL 必须在失效时 `revokeObjectURL()`。

第一版可以先只转换当前会话最近 5 个 ready turn。

---

## 29. 错误状态设计

区分：

```text
设置错误
模型连接错误
模型输出错误
Mermaid 转换错误
附件错误
插入错误
数据库错误
```

不要把这些都写入：

```text
saveError
```

建议 AI 面板内独立展示。

用户可理解提示：

| 情况 | 提示 |
|---|---|
| 未配置模型 | 请先在设置中配置 AI 模型 |
| 图片模型不支持 | 当前模型无法识别图片，请配置视觉模型 |
| 图片过大 | 图片不能超过 8 MB |
| 生成超时 | 模型响应超时 |
| Mermaid 解析失败 | Mermaid 无法解析，可尝试 AI 修复 |
| 会话不存在 | 对话可能已被删除，请新建对话 |
| 当前无活动画布 | 请先打开一个画布再插入 |
| 插入失败 | 图表插入失败，当前画布未被修改 |

---

## 30. 日志与隐私

允许记录：

```text
ai.session.created
ai.session.deleted
ai.turn.started
ai.turn.completed
ai.turn.failed
ai.attachment.saved
ai.diagram.inserted
```

可记录：

- sessionId；
- turnId；
- model；
- 耗时；
- 元素数量；
- 图片字节数；
- 错误类型。

不要记录：

- 完整 prompt；
- Mermaid 全文；
- 图片内容；
- Data URL；
- 完整工作区路径；
- 完整模型响应；
- 画布 JSON。

设置页隐私说明更新为：

```text
AI 功能只会发送你输入的内容，以及你明确添加的截图或选区摘要。
截图和 AI 对话历史保存在本机应用数据目录。
数据是否离开本机取决于你配置的模型服务地址。
```

---

## 31. 测试要求

### 31.1 Repository

覆盖：

```text
创建会话
工作区隔离
按更新时间排序
更新草稿
重命名
删除会话级联删除 turns
创建 generating turn
成功完成 turn
失败 turn
标记插入
应用启动修复中断状态
```

### 31.2 附件

覆盖：

```text
接受 PNG/JPEG/WEBP
拒绝 SVG
拒绝空文件
拒绝超过 8 MB
不使用用户文件名作为磁盘路径
删除会话时清理附件
```

### 31.3 PromptBuilder

覆盖：

```text
普通生成
基于 Mermaid 修改
截图重绘
截图参考
选区扩展
不泄露 sourceElementId
```

### 31.4 选区

覆盖：

```text
形状和绑定文本合并为一个节点
独立文本单独成节点
箭头读取绑定标签
不发送 UUID 作为 label
单文本截断
节点与边上限
自由布局判断
真实数量和纳入数量
```

### 31.5 Renderer

至少验证：

```text
关闭再打开面板仍保留会话
切换标签面板不关闭
新建会话
切换历史会话
草稿切换后仍存在
图片粘贴
删除附件
基于历史结果修改
插入当前活动画布
```

---

## 32. 分阶段实施计划

弱 Agent 必须按顺序执行，不得跳阶段。

### 阶段 0：修复现有 V1

1. 修复 Mermaid 失败后无法 AI 修复；
2. 清理旧 diagram / preview；
3. 增加转换元素上限；
4. 改进 SelectionContextExtractor；
5. 插入错误与 saveError 分离；
6. 删除 `pnpm-lock.yaml`；
7. 运行：

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

### 阶段 1：移动 AI 入口

1. 删除 navbar AI 按钮；
2. 删除 EditorPage topbar AI 按钮；
3. 删除 `drawspace:open-ai` window event；
4. 新增 `AiCanvasTrigger`；
5. 放入画布覆盖层；
6. 暂时仍可打开旧弹窗；
7. 手动验证不遮挡 Excalidraw 控件。

此阶段只移动入口，不做会话系统。

### 阶段 2：建立数据库能力

1. 新增 AI 表迁移；
2. 新增 `AiConversationRepository`；
3. 编写 Repository 测试；
4. 接入 `DatabaseService.aiConversations`；
5. 运行全部检查。

此阶段不改 UI。

### 阶段 3：会话 CRUD 和 IPC

1. 新增共享类型；
2. 新增 Zod；
3. 新增 channels；
4. 新增 `AiConversationService` 基础 CRUD；
5. 新增 IPC；
6. 新增 preload；
7. 测试工作区隔离。

### 阶段 4：工作区面板骨架

1. `EditorWorkspacePage` 增加 `editor-workbench`；
2. 创建 `AiWorkspacePanel`；
3. 创建左侧会话列表；
4. 创建新建、切换、重命名、删除；
5. 草稿写入 SQLite；
6. 关闭再打开恢复；
7. 切换标签不关闭。

此阶段可以先不生成图表。

### 阶段 5：迁移现有生成链路

1. 创建 `AiPromptBuilder`；
2. 创建 `generateTurn`；
3. 生成前创建数据库 turn；
4. 成功或失败后更新数据库；
5. 右侧展示 turn；
6. 历史 Mermaid 重新转换预览；
7. 插入当前画布；
8. 标记插入记录；
9. 删除旧 `AiDiagramDialog`。

### 阶段 6：AiCanvasBridge

1. 定义接口；
2. EditorPage 注册桥接；
3. WorkspacePage 获取活动桥接；
4. 发送时读取选区；
5. 插入时调用活动桥接；
6. 测试多标签。

### 阶段 7：截图多模态

1. 扩展 ChatMessage；
2. 增加 `visionModel`；
3. 增加附件服务；
4. 支持文件选择；
5. 支持拖拽；
6. 支持粘贴；
7. 发送到视觉模型；
8. 持久化附件；
9. 更新隐私说明。

### 阶段 8：选区视觉上下文

1. 导出选区 PNG；
2. 增加“同时参考选区外观”；
3. 结构摘要和选区截图同时发送；
4. 失败时降级为仅摘要。

### 阶段 9：最终回归

运行：

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
```

手动测试：

```text
新建工作区会话
关闭面板再打开
关闭应用再打开
切换标签
新建第二个会话
重命名和删除
文本生成
截图生成
参考选区
截图 + 选区
基于旧 Mermaid 修改
插入当前画布
Ctrl+Z
自动保存
导出
深色模式
模型断开
超时
图片过大
```

---

## 33. 验收标准

### 入口

- [ ] navbar 不再显示 AI 按钮
- [ ] 编辑器 topbar 不再显示 AI 按钮
- [ ] 画布内只显示 Sparkles 图标
- [ ] 图标有 Tooltip、aria-label 和激活状态
- [ ] 图标不随画布缩放移动
- [ ] 图标不遮挡常用 Excalidraw 控件

### 会话

- [ ] 对话按工作区隔离
- [ ] 可新建、切换、重命名、删除
- [ ] 左侧显示当前画布和其他画布对话
- [ ] 关闭面板后重新打开内容仍在
- [ ] 应用重启后历史仍在
- [ ] 草稿不会因关闭面板丢失
- [ ] 切换画布时面板保持打开

### 生成

- [ ] 每次生成产生一个 turn
- [ ] 生成状态持久化
- [ ] 错误记录持久化
- [ ] 历史 Mermaid 可重新预览
- [ ] 可基于历史结果继续修改
- [ ] 不默认发送完整聊天历史

### 选区

- [ ] 发送时读取最新选区
- [ ] 形状和绑定文字不重复
- [ ] 箭头标签正确
- [ ] 不向模型发送原始元素 UUID
- [ ] 可查看发送摘要
- [ ] 可选择是否发送选区图片

### 截图

- [ ] 支持选择文件
- [ ] 支持拖拽
- [ ] 支持粘贴
- [ ] 只允许 PNG/JPEG/WEBP
- [ ] 最大 8 MB
- [ ] 图片保存在本地应用数据目录
- [ ] 历史会话重新打开后附件仍可用

### 插入和保存

- [ ] 历史结果可插入当前活动画布
- [ ] 插入后选中新元素
- [ ] Ctrl+Z 可撤销
- [ ] 使用现有 dirty / 自动保存链路
- [ ] AI 插入错误不显示为保存错误
- [ ] 多标签切换不插入错误画布

---

## 34. Agent 实施约束

1. 不重构与 AI 无关的工作区、保存和恢复逻辑。
2. 不创建第二套画布保存机制。
3. 不把完整画布 JSON 传给模型。
4. 不让模型生成 Excalidraw JSON。
5. 不将模型请求移动到 Renderer。
6. 不暴露通用 IPC。
7. 不使用 `any` 绕过 Excalidraw 类型。
8. 不直接修改 Excalidraw 内部 DOM。
9. 不在一个提交中同时完成全部阶段。
10. 每个阶段结束后运行类型检查和测试。
11. 数据库写入必须使用事务处理关联操作。
12. Renderer 传来的数据必须在主进程再次 Zod 校验。
13. 图片文件名和磁盘路径必须由主进程生成。
14. 不在日志中记录 prompt、图片或完整 Mermaid。
15. 不因 AI 功能破坏多标签、自动保存、撤销和导出。
16. 如果某阶段无法通过测试，不得继续后续阶段。
17. 旧 `AiDiagramDialog` 只能在新面板闭环完成后删除。
18. 优先做可工作的小实现，不提前加入流式、搜索、分支会话等能力。

---

## 35. 后续方向

本次完成后再考虑：

### V2.1

- 真正取消模型请求；
- 面板宽度拖动；
- 会话搜索；
- 会话收藏；
- 图片自动压缩；
- 历史分页和虚拟列表；
- 流式状态提示。

### V2.2

- `DiagramPatch` 中间协议；
- 新生成节点与旧节点自动连接；
- 选区颜色和样式继承；
- 对现有元素进行受限修改；
- 生成结果差异预览。

### V3

- Agent 操作画布；
- 多工具调用；
- MCP；
- 更通用的自由图形生成；
- 自有 DiagramSpec。

---

## 36. 最终交付内容

Agent 完成后应提交：

```text
1. 源代码
2. 数据库迁移
3. 单元测试
4. 必要 E2E 测试
5. package-lock.json
6. 删除 pnpm-lock.yaml
7. README AI 会话功能说明
8. README 截图和隐私说明
9. 浅色与深色界面截图
10. 已知限制
11. 实施阶段与测试结果摘要
```

README 至少说明：

```text
工作区级 AI 对话
画布内 AI 图标入口
历史对话保存位置
截图支持
选区上下文
文本模型与视觉模型
数据发送和隐私边界
当前仍以 Mermaid 为中间格式
```
