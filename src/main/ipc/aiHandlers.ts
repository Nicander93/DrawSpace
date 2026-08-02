import { aiSettingsSchema, generateMermaidRequestSchema, repairMermaidRequestSchema } from "@shared/schemas";
import { IPC_CHANNELS } from "@shared/channels";
import type { AiDiagramService } from "../services/ai/AiDiagramService";
import type { IpcHandle } from "./types";

export const registerAiHandlers = (handle: IpcHandle, aiDiagramService: AiDiagramService): void => {
  handle(IPC_CHANNELS.aiGetSettings, () => aiDiagramService.getSettings());
  handle(IPC_CHANNELS.aiSaveSettings, (input) => aiDiagramService.saveSettings(aiSettingsSchema.parse(input)));
  handle(IPC_CHANNELS.aiTestConnection, (input) => aiDiagramService.testConnection(input === undefined ? undefined : aiSettingsSchema.parse(input)));
  handle(IPC_CHANNELS.aiGenerateMermaid, (input) => aiDiagramService.generate(generateMermaidRequestSchema.parse(input)));
  handle(IPC_CHANNELS.aiRepairMermaid, (input) => aiDiagramService.repair(repairMermaidRequestSchema.parse(input)));
};
