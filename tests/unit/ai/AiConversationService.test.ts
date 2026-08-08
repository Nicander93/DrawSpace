import { describe, expect, it, vi } from "vitest";
import type { AiSessionDetail, AiSettings, AiTurn } from "../../../src/shared/types";
import { AiConversationService } from "../../../src/main/services/ai/AiConversationService";
import { AiPromptBuilder } from "../../../src/main/services/ai/AiPromptBuilder";

const settings: AiSettings = {
  baseUrl: "http://localhost:1234/v1",
  model: "diagram-model",
  temperature: 0.2,
  timeoutMs: 10_000
};

describe("AiConversationService", () => {
  it("returns a generating turn before the model request completes", async () => {
    const session = {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      turns: []
    } as unknown as AiSessionDetail;
    const turn = {
      id: "33333333-3333-4333-8333-333333333333",
      sessionId: session.id,
      mode: "create",
      prompt: "画一个流程图",
      status: "generating",
      createdAt: Date.now(),
      attachments: []
    } as AiTurn;
    let completed: AiTurn = turn;
    const repository = {
      getSession: vi.fn(() => session),
      createTurn: vi.fn(() => turn),
      updateTurnContext: vi.fn(),
      completeTurn: vi.fn(() => { completed = { ...turn, status: "ready", mermaid: "flowchart TD\nA-->B" }; }),
      failTurn: vi.fn(),
      getTurn: vi.fn(() => completed)
    };
    const client = {
      complete: vi.fn(async () => "```mermaid\nflowchart TD\nA-->B\n```")
    };
    const service = new AiConversationService(
      repository as never,
      { get: vi.fn(async () => settings) } as never,
      client as never,
      { saveImage: vi.fn(), readDataUrl: vi.fn() } as never,
      new AiPromptBuilder()
    );
    const updates: AiTurn[] = [];
    service.onTurnUpdated((value) => updates.push(value));

    const returned = await service.generateTurn({
      sessionId: session.id,
      prompt: "画一个流程图",
      mode: "create"
    });

    expect(returned.status).toBe("generating");
    expect(repository.createTurn).toHaveBeenCalledWith(expect.objectContaining({ modelName: "diagram-model" }));
    await vi.waitFor(() => expect(client.complete).toHaveBeenCalled());
    expect(updates.at(-1)?.status).toBe("ready");
  });

  it("rejects image requests when no vision model is configured", async () => {
    const session = {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      turns: []
    } as unknown as AiSessionDetail;
    const repository = {
      getSession: vi.fn(() => session),
      createTurn: vi.fn()
    };
    const service = new AiConversationService(
      repository as never,
      { get: vi.fn(async () => settings) } as never,
      { complete: vi.fn() } as never,
      {} as never,
      new AiPromptBuilder()
    );

    await expect(service.generateTurn({
      sessionId: session.id,
      prompt: "根据截图生成流程图",
      mode: "reference_image",
      images: [{ fileName: "flow.png", mimeType: "image/png", data: new ArrayBuffer(8) }]
    })).rejects.toThrow("当前未配置视觉模型");
    expect(repository.createTurn).not.toHaveBeenCalled();
  });

  it("uses the configured vision model only for image requests", async () => {
    const session = {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      turns: []
    } as unknown as AiSessionDetail;
    const turn = {
      id: "33333333-3333-4333-8333-333333333333",
      sessionId: session.id,
      mode: "reference_image",
      prompt: "根据截图生成流程图",
      status: "generating",
      createdAt: Date.now(),
      attachments: []
    } as AiTurn;
    const repository = {
      getSession: vi.fn(() => session),
      createTurn: vi.fn(() => turn),
      updateTurnContext: vi.fn(),
      completeTurn: vi.fn(),
      failTurn: vi.fn(),
      getTurn: vi.fn(() => turn)
    };
    const client = { complete: vi.fn(async () => "flowchart TD\nA-->B") };
    const attachment = { id: "attachment-1" };
    const service = new AiConversationService(
      repository as never,
      { get: vi.fn(async () => ({ ...settings, visionModel: "vision-model" })) } as never,
      client as never,
      {
        saveImage: vi.fn(async () => attachment),
        readDataUrl: vi.fn(async () => "data:image/png;base64,AA==")
      } as never,
      new AiPromptBuilder()
    );

    await service.generateTurn({
      sessionId: session.id,
      prompt: "根据截图生成流程图",
      mode: "reference_image",
      images: [{ fileName: "flow.png", mimeType: "image/png", data: new ArrayBuffer(8) }]
    });

    expect(repository.createTurn).toHaveBeenCalledWith(expect.objectContaining({ modelName: "vision-model" }));
    await vi.waitFor(() => expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: "vision-model" }),
      expect.any(Array)
    ));
  });
});
