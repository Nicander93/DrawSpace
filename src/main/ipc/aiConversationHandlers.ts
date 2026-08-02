import {
  createAiSessionRequestSchema,
  generateAiTurnRequestSchema,
  aiSessionIdSchema,
  repairAiTurnRequestSchema,
  updateAiSessionRequestSchema
} from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import type { AiConversationService } from "../services/ai/AiConversationService";
import type { IpcHandle } from "./types";

export const registerAiConversationHandlers = (handle: IpcHandle, service: AiConversationService): void => {
  handle(IPC_CHANNELS.aiListSessions, (workspaceId) => service.listSessions(aiSessionIdSchema.parse(workspaceId)));
  handle(IPC_CHANNELS.aiCreateSession, (input) => service.createSession(createAiSessionRequestSchema.parse(input)));
  handle(IPC_CHANNELS.aiGetSession, (sessionId) => service.getSession(aiSessionIdSchema.parse(sessionId)));
  handle(IPC_CHANNELS.aiUpdateSession, (input) => service.updateSession(updateAiSessionRequestSchema.parse(input)));
  handle(IPC_CHANNELS.aiDeleteSession, (sessionId) => service.deleteSession(aiSessionIdSchema.parse(sessionId)));
  handle(IPC_CHANNELS.aiGenerateTurn, (input) => service.generateTurn(generateAiTurnRequestSchema.parse(input)));
  handle(IPC_CHANNELS.aiRepairTurn, (input) => service.repairTurn(repairAiTurnRequestSchema.parse(input)));
  handle(IPC_CHANNELS.aiMarkTurnInserted, (turnId, documentId) => service.markInserted(aiSessionIdSchema.parse(turnId), aiSessionIdSchema.parse(documentId)));
};
