import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiAttachment, AiImageUpload } from "@shared/types";
import type { AiConversationRepository } from "../../database/AiConversationRepository";
import type { AppLogger } from "../AppLogger";
import { validateAiImage } from "./imageValidation";

export class AiAttachmentService {
  constructor(
    private readonly userDataPath: string,
    private readonly repository: AiConversationRepository,
    private readonly logger?: AppLogger
  ) {}

  async saveImage(input: { workspaceId: string; sessionId: string; turnId: string; image: AiImageUpload; kind?: AiAttachment["kind"] }): Promise<AiAttachment> {
    validateAiImage(input.image);
    const id = randomUUID();
    const directory = join(this.userDataPath, "ai-attachments", input.workspaceId, input.sessionId);
    const filePath = join(directory, `${id}.${input.image.mimeType === "image/jpeg" ? "jpg" : input.image.mimeType.slice("image/".length)}`);
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, Buffer.from(input.image.data));
    try {
      const attachment = this.repository.addAttachment({
        sessionId: input.sessionId, turnId: input.turnId, kind: input.kind ?? "uploaded_image",
        mimeType: input.image.mimeType, filePath, byteSize: input.image.data.byteLength
      });
      this.logger?.info("ai.attachment.saved", { sessionId: input.sessionId, turnId: input.turnId, attachmentId: attachment.id, byteSize: attachment.byteSize });
      return attachment;
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async readDataUrl(attachment: AiAttachment): Promise<string> {
    const data = await readFile(this.repository.getAttachmentPath(attachment.id));
    return `data:${attachment.mimeType};base64,${data.toString("base64")}`;
  }

  async removeSessionAttachments(sessionId: string): Promise<void> {
    const paths = this.repository.listAttachmentPaths(sessionId);
    await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)));
  }
}
