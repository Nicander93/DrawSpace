import type { ExcalidrawFile } from "@shared/types";
import type { SaveOutcome, SaveReason, SaveSnapshot, SaveStatus } from "./saveTypes";

export const AUTO_SAVE_DEBOUNCE_MS = 5_000;
export const AUTO_SAVE_MAX_WAIT_MS = 30_000;
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
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.latestRevision === this.persistedRevision + 1) {
      this.scheduleMaxWait();
    }
    this.scheduleDebounce();
  }

  public requestSave(reason: SaveReason): Promise<SaveOutcome> {
    if (this.disposed) return Promise.resolve({ status: "noop" });
    this.saveRequested = true;
    this.clearDebounce();
    if (!this.drainPromise) {
      this.drainPromise = this.drain(reason).finally(() => {
        this.drainPromise = null;
      });
    }
    return this.drainPromise;
  }

  public dispose(): void {
    this.disposed = true;
    this.clearDebounce();
    this.clearMaxWait();
    this.saveRequested = false;
  }

  private scheduleDebounce(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.requestSave("auto-debounce");
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  private scheduleMaxWait(): void {
    if (this.maxWaitTimer) return;
    this.maxWaitTimer = setTimeout(() => {
      this.maxWaitTimer = null;
      void this.requestSave("auto-max-wait");
    }, AUTO_SAVE_MAX_WAIT_MS);
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
        this.clearDebounce();
        this.clearMaxWait();
        break;
      }
      if (outcome.status === "conflict") {
        this.options.onStatusChange("conflict", outcome.message);
        this.clearDebounce();
        this.clearMaxWait();
        break;
      }
      this.persistedRevision = Math.max(this.persistedRevision, revision);
      if (this.hasUnsavedChanges) {
        this.saveRequested = true;
      } else {
        this.clearDebounce();
        this.clearMaxWait();
        this.options.onStatusChange("saved", null);
      }
    }
    return outcome;
  }

  private clearDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private clearMaxWait(): void {
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    this.maxWaitTimer = null;
  }
}
