import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawFile } from "@shared/types";
import { DocumentSaveCoordinator } from "./DocumentSaveCoordinator";

const scene: ExcalidrawFile = {
  type: "excalidraw",
  version: 2,
  source: "test",
  elements: [],
  appState: {},
  files: {}
};

describe("DocumentSaveCoordinator", () => {
  afterEach(() => vi.useRealTimers());

  it("串行处理保存期间产生的新 revision", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const saves: number[] = [];
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: async (snapshot) => {
        saves.push(snapshot.revision);
        if (saves.length === 1) await new Promise<void>((resolve) => { release = resolve; });
        return { status: "saved" };
      },
      onStatusChange: () => undefined
    });

    coordinator.markChanged();
    const first = coordinator.requestSave("manual");
    coordinator.markChanged();
    release();
    await first;
    expect(saves).toEqual([1, 2]);
  });

  it("持续编辑时保留最长等待计时器", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => ({ status: "saved" as const }));
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: save,
      onStatusChange: () => undefined
    });
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(29_000);
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("uses a five second debounce and resets it after another edit", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => ({ status: "saved" as const }));
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: save,
      onStatusChange: () => undefined
    });

    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(save).not.toHaveBeenCalled();
    coordinator.markChanged();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps dirty state and reports an error without retrying forever", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: async () => ({ status: "failed" as const, message: "disk full" }),
      onStatusChange: (status) => statuses.push(status)
    });

    coordinator.markChanged();
    const outcome = await coordinator.requestSave("manual");
    expect(outcome.status).toBe("failed");
    expect(coordinator.hasUnsavedChanges).toBe(true);
    expect(statuses).toContain("error");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(statuses.filter((status) => status === "error")).toHaveLength(1);
  });

  it("does not save after dispose", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => ({ status: "saved" as const }));
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: save,
      onStatusChange: () => undefined
    });
    coordinator.markChanged();
    coordinator.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).not.toHaveBeenCalled();
  });

  it("forces a save at the thirty second maximum while edits continue", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => ({ status: "saved" as const }));
    const coordinator = new DocumentSaveCoordinator({
      documentId: "doc",
      getScene: () => scene,
      getExpectedVersion: () => "1:1",
      executeSave: save,
      onStatusChange: () => undefined
    });
    coordinator.markChanged();
    for (let index = 0; index < 7; index += 1) {
      await vi.advanceTimersByTimeAsync(4_000);
      coordinator.markChanged();
    }
    await vi.advanceTimersByTimeAsync(2_000);
    expect(save).toHaveBeenCalled();
  });

  it("isolates save failures between two document coordinators", async () => {
    const saveA = vi.fn(async () => ({ status: "failed" as const, message: "A failed" }));
    const saveB = vi.fn(async () => ({ status: "saved" as const }));
    const coordinatorA = new DocumentSaveCoordinator({
      documentId: "a",
      getScene: () => scene,
      getExpectedVersion: () => "a:1",
      executeSave: saveA,
      onStatusChange: () => undefined
    });
    const coordinatorB = new DocumentSaveCoordinator({
      documentId: "b",
      getScene: () => scene,
      getExpectedVersion: () => "b:1",
      executeSave: saveB,
      onStatusChange: () => undefined
    });

    coordinatorA.markChanged();
    coordinatorB.markChanged();
    const [outcomeA, outcomeB] = await Promise.all([
      coordinatorA.requestSave("manual"),
      coordinatorB.requestSave("manual")
    ]);

    expect(outcomeA.status).toBe("failed");
    expect(outcomeB.status).toBe("saved");
    expect(coordinatorA.hasUnsavedChanges).toBe(true);
    expect(coordinatorB.hasUnsavedChanges).toBe(false);
    expect(saveA).toHaveBeenCalledTimes(1);
    expect(saveB).toHaveBeenCalledTimes(1);
  });
});
