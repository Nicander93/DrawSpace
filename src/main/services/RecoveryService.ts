import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RecoveryItem, RecoverySnapshot } from "@shared/types";
import { recoverySnapshotSchema } from "@shared/schemas";
import { DatabaseService } from "../database/DatabaseService";
import { WorkspaceService } from "./WorkspaceService";

export class RecoveryService {
  private readonly recoveryDirectory: string;

  constructor(
    userDataPath: string,
    private readonly database: DatabaseService,
    private readonly workspaceService: WorkspaceService
  ) {
    this.recoveryDirectory = resolve(userDataPath, "recovery");
  }

  async initialize(): Promise<void> {
    await mkdir(this.recoveryDirectory, { recursive: true });
  }

  async save(snapshot: RecoverySnapshot): Promise<void> {
    const parsedSnapshot = recoverySnapshotSchema.parse(snapshot);
    await writeFile(
      this.getSnapshotPath(parsedSnapshot.documentId),
      JSON.stringify(parsedSnapshot),
      "utf8"
    );
  }

  async list(): Promise<RecoveryItem[]> {
    const fileNames = await readdir(this.recoveryDirectory);
    const recoveryItems: RecoveryItem[] = [];

    for (const fileName of fileNames.filter((name) => name.endsWith(".json"))) {
      try {
        const fileContent = await readFile(
          resolve(this.recoveryDirectory, fileName),
          "utf8"
        );
        const snapshot = recoverySnapshotSchema.parse(JSON.parse(fileContent));
        const document = this.database.getDocument(snapshot.documentId);
        if (!document) {
          continue;
        }
        const sourceStat = await this.workspaceService
          .getStorageProvider()
          .stat(document.relativePath);
        if (
          snapshot.savedAt > (sourceStat?.modifiedAt ?? 0) &&
          this.database.wasSessionInterrupted(snapshot.sessionId)
        ) {
          recoveryItems.push({
            ...snapshot,
            documentName: document.name
          });
        }
      } catch {
        continue;
      }
    }
    return recoveryItems;
  }

  async get(documentId: string): Promise<RecoverySnapshot> {
    const fileContent = await readFile(this.getSnapshotPath(documentId), "utf8");
    return recoverySnapshotSchema.parse(JSON.parse(fileContent));
  }

  async discard(documentId: string): Promise<void> {
    await unlink(this.getSnapshotPath(documentId)).catch(() => undefined);
  }

  private getSnapshotPath(documentId: string): string {
    return resolve(this.recoveryDirectory, `${documentId}.json`);
  }
}
