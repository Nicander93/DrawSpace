import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { AiConversationRepository } from "@main/database/AiConversationRepository";
import { applyAiConversationMigration } from "@main/database/aiConversationMigration";

const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();

describe("AiConversationRepository", () => {
  let database: Database.Database;
  let repository: AiConversationRepository;

  afterEach(() => database.close());

  const setup = (): void => {
    database = new Database(":memory:");
    database.exec(`CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, provider_type TEXT, root_path TEXT, created_at INTEGER, last_opened_at INTEGER, is_active INTEGER);
      CREATE TABLE documents (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT);`);
    database.prepare("INSERT INTO workspaces VALUES (?, 'A', 'local', '/', 1, 1, 1)").run(workspaceId);
    database.prepare("INSERT INTO workspaces VALUES (?, 'B', 'local', '/b', 1, 1, 0)").run(otherWorkspaceId);
    database.prepare("INSERT INTO documents VALUES (?, ?, '系统设计')").run("document-for-test", workspaceId);
    applyAiConversationMigration(database);
    repository = new AiConversationRepository(database);
  };

  it("按工作区隔离并支持会话 CRUD、草稿和 turn 状态", () => {
    setup();
    const first = repository.createSession({ workspaceId, title: "新对话" });
    repository.createSession({ workspaceId: otherWorkspaceId, title: "另一个工作区" });
    expect(repository.listSessions(workspaceId)).toHaveLength(1);
    repository.updateSession({ sessionId: first.id, title: "登录流程", draftPrompt: "补充数据库" });
    expect(repository.getSession(first.id)?.draftPrompt).toBe("补充数据库");
    const turn = repository.createTurn({ sessionId: first.id, mode: "create", prompt: "画登录流程" });
    expect(turn.status).toBe("generating");
    repository.completeTurn(turn.id, "flowchart LR\nA-->B");
    expect(repository.getSession(first.id)?.turns[0]?.mermaid).toContain("flowchart");
    repository.markTurnInserted(turn.id, "document-for-test");
    expect(repository.getTurn(turn.id)?.insertedDocumentId).toBe("document-for-test");
    repository.deleteSession(first.id);
    expect(repository.getSession(first.id)).toBeNull();
  });

  it("启动时将中断的生成标记为错误", () => {
    setup();
    const session = repository.createSession({ workspaceId, title: "会话" });
    repository.createTurn({ sessionId: session.id, mode: "create", prompt: "生成图表" });
    expect(repository.markInterruptedTurns()).toBe(1);
    expect(repository.getSession(session.id)?.turns[0]?.errorMessage).toBe("应用退出或生成过程被中断");
  });
});
