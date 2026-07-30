import type { ExcalidrawFile } from "@shared/types";
import type { SaveOutcome, SaveReason, SaveSnapshot, SaveStatus } from "./saveTypes";

export const RECOVERY_INTERVAL_MS = 10_000;

interface CoordinatorOptions {
  documentId: string;
  getScene(): ExcalidrawFile | null;
  getExpectedVersion(): string;
  executeSave(snapshot: SaveSnapshot): Promise<SaveOutcome>;
  onStatusChange(status: SaveStatus, error: string | null): void;
}

export class DocumentSaveCoordinator {
  private readonly options: CoordinatorOptions;
  private latestRevision = 0;
  private persistedRevision = 0;
  private saveRequested = false;
  private drainPromise: Promise<SaveOutcome> | null = null;
  private disposed = false;

  public constructor(options: CoordinatorOptions) {
    this.options = options;
  }

  public get hasUnsavedChanges(): boolean {
    return this.latestRevision !== this.persistedRevision;
  }

  public markBaseline(): void {
    this.persistedRevision = this.latestRevision;
  }

  public markChanged(): void {
    if (this.disposed) return;
    this.latestRevision += 1;
    this.options.onStatusChange("dirty", null);
  }

  public requestSave(reason: SaveReason): Promise<SaveOutcome> {
    if (this.disposed) return Promise.resolve({ status: "noop" });
    this.saveRequested = true;
    if (!this.drainPromise) {
      this.drainPromise = this.drain(reason).finally(() => {
        this.drainPromise = null;
      });
    }
    return this.drainPromise;
  }

  /** 重新激活因组件开发模式预清理而释放的协调器。 */
  public activate(): void {
    this.disposed = false;
  }

  public dispose(): void {
    this.disposed = true;
    this.saveRequested = false;
  }

  private async drain(reason: SaveReason): Promise<SaveOutcome> {
    let outcome: SaveOutcome = { status: "noop" };
    while (this.saveRequested && this.hasUnsavedChanges && !this.disposed) {
      this.saveRequested = false;
      const sceneData = this.options.getScene();
      if (!sceneData) break;
      const revision = this.latestRevision;
      const snapshot: SaveSnapshot = {
        revision,
        documentId: this.options.documentId,
        expectedVersion: this.options.getExpectedVersion(),
        sceneData,
        reason
      };
      this.options.onStatusChange("saving", null);
      outcome = await this.options.executeSave(snapshot);
      if (outcome.status === "failed") {
        this.options.onStatusChange("error", outcome.message);
        break;
      }
      if (outcome.status === "conflict") {
        this.options.onStatusChange("conflict", outcome.message);
        break;
      }
      this.persistedRevision = Math.max(this.persistedRevision, revision);
      if (this.hasUnsavedChanges) {
        this.saveRequested = true;
      } else {
        this.options.onStatusChange("saved", null);
      }
    }
    return outcome;
  }
}
