import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "@main/storage/LocalStorageProvider";
import { StorageError } from "@main/storage/StorageError";



describe("LocalStorageProvider", () => {
  let workspacePath: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    workspacePath = await mkdtemp(resolve(tmpdir(), "drawspace-storage-"));
    provider = new LocalStorageProvider(workspacePath);
    await provider.initialize();
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it("拒绝访问工作区外路径", () => {
    expect(() => provider.resolvePath("../outside.excalidraw")).toThrow(
      "不在当前工作区内"
    );
    expect(() => provider.resolvePath("/tmp/outside.excalidraw")).toThrow(
      "绝对路径"
    );
  });

  it("通过临时文件原子写入并返回版本", async () => {
    const result = await provider.write(
      "产品设计/首页.excalidraw",
      new TextEncoder().encode("first")
    );

    expect(result.version).toBeTruthy();
    expect(
      await readFile(resolve(workspacePath, "产品设计/首页.excalidraw"), "utf8")
    ).toBe("first");
    const entries = await provider.list("产品设计");
    expect(entries.entries.map((entry) => entry.name)).toEqual(["首页.excalidraw"]);
  });

  it("覆盖已有文件时仍能原子写入", async () => {
    await provider.write("画布.excalidraw", new TextEncoder().encode("first"));
    const result = await provider.write(
      "画布.excalidraw",
      new TextEncoder().encode("second")
    );

    expect(result.version).toBeTruthy();
    expect(await readFile(resolve(workspacePath, "画布.excalidraw"), "utf8")).toBe(
      "second"
    );
    const names = await readdir(workspacePath);
    expect(names.some((name) => name.includes("drawspace-backup") || name.endsWith(".tmp"))).toBe(false);
  });

  it("预期版本不一致时停止覆盖", async () => {
    await provider.write("画布.excalidraw", new TextEncoder().encode("first"));
    const currentStat = await provider.stat("画布.excalidraw");
    await writeFile(resolve(workspacePath, "画布.excalidraw"), "external");

    const error = await provider.write(
      "画布.excalidraw",
      new TextEncoder().encode("local"),
      { expectedVersion: currentStat?.version }
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe("VERSION_CONFLICT");
    expect(await readFile(resolve(workspacePath, "画布.excalidraw"), "utf8")).toBe(
      "external"
    );
  });

  it("recovers an interrupted backup before the next write", async () => {
    await provider.write("画布.excalidraw", new TextEncoder().encode("old"));
    await writeFile(resolve(workspacePath, ".画布.excalidraw.drawspace-backup"), "backup");
    await rm(resolve(workspacePath, "画布.excalidraw"));

    await provider.write("画布.excalidraw", new TextEncoder().encode("new"));
    expect(await readFile(resolve(workspacePath, "画布.excalidraw"), "utf8")).toBe("new");
    await expect(readdir(workspacePath)).resolves.not.toContain(".画布.excalidraw.drawspace-backup");
  });

  it("递归扫描时排除内部和隐藏目录", async () => {
    await provider.write("正常/一.excalidraw", new TextEncoder().encode("{}"));
    await provider.write(".drawspace/trash/二.excalidraw", new TextEncoder().encode("{}"));
    await provider.write(".hidden/三.excalidraw", new TextEncoder().encode("{}"));

    const result = await provider.list("", { recursive: true });
    expect(result.entries.map((entry) => entry.path)).toContain("正常/一.excalidraw");
    expect(
      result.entries.some((entry) => entry.path.includes(".drawspace"))
    ).toBe(false);
    expect(result.entries.some((entry) => entry.path.includes(".hidden"))).toBe(
      false
    );
  });
});
