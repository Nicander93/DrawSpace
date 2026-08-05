import type {
  AiSessionDetail, AiSessionSummary, AiTurn, AiSettings, CreateAiSessionRequest, GenerateAiTurnRequest,
  RepairAiTurnRequest, UpdateAiSessionRequest
} from "@shared/types";
import { generateAiTurnRequestSchema, repairAiTurnRequestSchema } from "@shared/schemas";
import type { AiConversationRepository } from "../../database/AiConversationRepository";
import type { AppLogger } from "../AppLogger";
import { AiSettingsService } from "./AiSettingsService";
import { AiAttachmentService } from "./AiAttachmentService";
import { AiPromptBuilder } from "./AiPromptBuilder";
import { OpenAiCompatibleClient } from "./OpenAiCompatibleClient";
import { extractMermaidContent } from "./mermaidResponse";

export type AiTurnUpdatedListener = (turn: AiTurn) => void;

export class AiConversationService {
  constructor(
    private readonly repository: AiConversationRepository,
    private readonly settingsService: AiSettingsService,
    private readonly client: OpenAiCompatibleClient,
    private readonly attachmentService: AiAttachmentService,
    private readonly promptBuilder: AiPromptBuilder,
    private readonly logger?: AppLogger
  ) {}

  private readonly turnUpdatedListeners = new Set<AiTurnUpdatedListener>();

  onTurnUpdated(listener: AiTurnUpdatedListener): () => void {
    this.turnUpdatedListeners.add(listener);
    return () => this.turnUpdatedListeners.delete(listener);
  }

  async listSessions(workspaceId: string): Promise<AiSessionSummary[]> { return this.repository.listSessions(workspaceId); }
  async createSession(input: CreateAiSessionRequest): Promise<AiSessionSummary> { return this.repository.createSession({ ...input, title: input.title ?? "新对话" }); }
  async getSession(sessionId: string): Promise<AiSessionDetail> { const session = this.repository.getSession(sessionId); if (!session) throw new Error("对话可能已被删除，请新建对话"); return session; }
  async updateSession(input: UpdateAiSessionRequest): Promise<AiSessionSummary> {
    return this.repository.updateSession(input);
  }
  async deleteSession(sessionId: string): Promise<void> { await this.attachmentService.removeSessionAttachments(sessionId); this.repository.deleteSession(sessionId); this.logger?.info("ai.session.deleted", { sessionId }); }

  async generateTurn(rawRequest: GenerateAiTurnRequest): Promise<AiTurn> {
    const request = generateAiTurnRequestSchema.parse(rawRequest);
    const session = this.repository.getSession(request.sessionId);
    if (!session) throw new Error("对话可能已被删除，请新建对话");
    const baseMermaid = request.baseTurnId ? session.turns.find((turn) => turn.id === request.baseTurnId)?.mermaid : undefined;
    if (request.mode === "revise" && !baseMermaid) throw new Error("找不到要修改的 Mermaid 结果");
    const settings = await this.settingsService.get();
    const modelName = request.images?.length ? (settings.visionModel ?? settings.model) : settings.model;
    const turn = this.repository.createTurn({ sessionId: request.sessionId, baseTurnId: request.baseTurnId, mode: request.mode, prompt: request.prompt, contextJson: JSON.stringify({ selection: request.selection, attachmentIds: [], capturedAt: Date.now() }), modelName });
    void this.processTurn(turn, request, settings, modelName, baseMermaid, session.id, session.workspaceId);
    return turn;
  }

  private async processTurn(
    turn: AiTurn,
    request: GenerateAiTurnRequest,
    settings: AiSettings,
    modelName: string,
    baseMermaid: string | undefined,
    sessionId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const attachments = request.images ? await Promise.all(request.images.map((image) => this.attachmentService.saveImage({ workspaceId, sessionId, turnId: turn.id, image }))) : [];
      this.repository.updateTurnContext(turn.id, JSON.stringify({ selection: request.selection, attachmentIds: attachments.map((attachment) => attachment.id), capturedAt: Date.now() }));
      const imageUrls = await Promise.all(attachments.map((attachment) => this.attachmentService.readDataUrl(attachment)));
      const messages = this.promptBuilder.buildMessages({ mode: request.mode, prompt: request.prompt, selection: request.selection, baseMermaid, images: imageUrls });
      const rawResponse = await this.client.complete({ ...settings, model: modelName }, messages);
      const mermaid = extractMermaidContent(rawResponse);
      this.repository.completeTurn(turn.id, mermaid);
      this.logger?.info("ai.turn.completed", { sessionId, turnId: turn.id });
      this.emitTurnUpdated(turn.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 图表生成失败";
      this.repository.failTurn(turn.id, message);
      this.logger?.warn("ai.turn.failed", { sessionId, turnId: turn.id, message });
      this.emitTurnUpdated(turn.id);
    }
  }

  private emitTurnUpdated(turnId: string): void {
    const turn = this.repository.getTurn(turnId);
    if (!turn) return;
    this.turnUpdatedListeners.forEach((listener) => listener(turn));
  }

  async repairTurn(rawRequest: RepairAiTurnRequest): Promise<AiTurn> {
    const request = repairAiTurnRequestSchema.parse(rawRequest);
    const source = this.repository.getTurn(request.turnId);
    if (!source?.mermaid) throw new Error("找不到需要修复的 Mermaid");
    return this.generateTurn({ sessionId: request.sessionId, prompt: `${request.prompt}\n\nMermaid 转换错误：${request.parseError}`, mode: "revise", baseTurnId: request.turnId, selection: request.selection });
  }

  async markInserted(turnId: string, documentId: string): Promise<void> { this.repository.markTurnInserted(turnId, documentId); this.logger?.info("ai.diagram.inserted", { turnId, documentId }); }
}
