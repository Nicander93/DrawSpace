import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseService } from "../database/DatabaseService";

export class ThumbnailService {
  private readonly thumbnailDirectory: string;

  constructor(
    userDataPath: string,
    private readonly database: DatabaseService
  ) {
    this.thumbnailDirectory = resolve(userDataPath, "thumbnails");
  }

  async initialize(): Promise<void> {
    await mkdir(this.thumbnailDirectory, { recursive: true });
  }

  async save(documentId: string, data: Uint8Array): Promise<void> {
    const thumbnailPath = this.getThumbnailPath(documentId);
    await writeFile(thumbnailPath, data);
    this.database.setThumbnail(documentId, thumbnailPath);
  }

  async delete(documentId: string): Promise<void> {
    await unlink(this.getThumbnailPath(documentId)).catch(() => undefined);
  }

  getThumbnailPath(documentId: string): string {
    return resolve(this.thumbnailDirectory, `${documentId}.png`);
  }
}
