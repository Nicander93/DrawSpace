import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import chokidar from "chokidar";
import type {
  StorageEntry,
  StorageProvider,
  StorageWatchEvent,
  StorageWriteResult
} from "./StorageProvider";
import { StorageError } from "./StorageError";

const EXCLUDED_DIRECTORIES = new Set([
  ".canvasdesk",
  "node_modules",
  ".git",
  "system volume information"
]);

const isExcludedDirectory = (directoryName: string): boolean => {
  const normalizedName = directoryName.toLowerCase();
  return (
    normalizedName.startsWith(".") ||
    normalizedName.startsWith("$") ||
    EXCLUDED_DIRECTORIES.has(normalizedName)
  );
};

export class LocalStorageProvider implements StorageProvider {
  readonly type = "local";
  private readonly normalizedRootPath: string;

  constructor(readonly rootPath: string) {
    this.normalizedRootPath = resolve(rootPath);
  }

  async initialize(): Promise<void> {
    await mkdir(this.normalizedRootPath, { recursive: true });
  }

  resolvePath(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new Error("不允许访问工作区之外的绝对路径");
    }

    const absolutePath = resolve(this.normalizedRootPath, relativePath || ".");
    const pathFromRoot = relative(this.normalizedRootPath, absolutePath);
    if (
      pathFromRoot === ".." ||
      pathFromRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error("目标路径不在当前工作区内");
    }
    return absolutePath;
  }

  toRelativePath(absolutePath: string): string {
    const relativePath = relative(this.normalizedRootPath, resolve(absolutePath));
    this.resolvePath(relativePath);
    return relativePath.replaceAll(sep, "/");
  }

  async list(
    relativePath: string,
    options?: { recursive?: boolean; cursor?: string; limit?: number }
  ): Promise<{ entries: StorageEntry[]; nextCursor?: string }> {
    const entries: StorageEntry[] = [];
    const startPath = this.resolvePath(relativePath);
    const recursive = options?.recursive ?? false;

    const visit = async (
      directoryPath: string,
      isRootDirectory = false
    ): Promise<void> => {
      let directoryEntries;
      try {
        directoryEntries = await readdir(directoryPath, { withFileTypes: true });
      } catch (error) {
        if (isRootDirectory) {
          throw error;
        }
        return;
      }
      for (const directoryEntry of directoryEntries) {
        if (
          directoryEntry.isDirectory() &&
          isExcludedDirectory(directoryEntry.name)
        ) {
          continue;
        }

        const absolutePath = resolve(directoryPath, directoryEntry.name);
        let entryStat;
        try {
          entryStat = await stat(absolutePath);
        } catch {
          continue;
        }
        const item: StorageEntry = {
          path: this.toRelativePath(absolutePath),
          name: directoryEntry.name,
          type: directoryEntry.isDirectory() ? "directory" : "file",
          size: entryStat.size,
          createdAt: entryStat.birthtimeMs,
          modifiedAt: entryStat.mtimeMs,
          version: `${entryStat.mtimeMs}:${entryStat.size}`
        };
        entries.push(item);
        if (recursive && directoryEntry.isDirectory()) {
          await visit(absolutePath);
        }
      }
    };

    await visit(startPath, true);
    const offset = options?.cursor ? Number(options.cursor) : 0;
    const limit = options?.limit ?? entries.length;
    const pageEntries = entries.slice(offset, offset + limit);
    const nextOffset = offset + pageEntries.length;

    return {
      entries: pageEntries,
      nextCursor: nextOffset < entries.length ? String(nextOffset) : undefined
    };
  }

  async read(relativePath: string): Promise<Uint8Array> {
    return readFile(this.resolvePath(relativePath));
  }

  async write(
    relativePath: string,
    data: Uint8Array,
    options?: { expectedVersion?: string }
  ): Promise<StorageWriteResult> {
    const absolutePath = this.resolvePath(relativePath);
    const parentPath = dirname(absolutePath);
    await mkdir(parentPath, { recursive: true });
    const backupPath = resolve(
      parentPath,
      `.${basename(absolutePath)}.canvasdesk-backup`
    );
    await this.recoverStaleBackup(absolutePath, backupPath);

    if (options?.expectedVersion) {
      const currentEntry = await this.stat(relativePath);
      if (currentEntry?.version !== options.expectedVersion) {
        throw new StorageError("VERSION_CONFLICT", "鏂囦欢宸茶澶栭儴淇敼");
        throw new Error("文件已被外部修改");
      }
    }

    const temporaryPath = resolve(
      parentPath,
      `.${basename(absolutePath)}.${randomUUID()}.tmp`
    );

    try {
      const fileHandle = await open(temporaryPath, "wx");
      try {
        await fileHandle.writeFile(data);
        await fileHandle.sync();
      } finally {
        await fileHandle.close();
      }
      try {
        await rename(temporaryPath, absolutePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPERM" && code !== "EEXIST") throw error;

        // Windows may refuse replacing an existing file while it is open.
        // Move the old file aside first, then rename the fully fsynced temp
        // file into place. Never copy the temp file over the live document.
        let hasBackup = false;
        try {
          await rename(absolutePath, backupPath);
          hasBackup = true;
          await rename(temporaryPath, absolutePath);
          await unlink(backupPath).catch(() => undefined);
        } catch (replacementError) {
          if (hasBackup) {
            await unlink(absolutePath).catch(() => undefined);
            await rename(backupPath, absolutePath).catch(() => undefined);
          }
          const code = (replacementError as NodeJS.ErrnoException).code;
          throw new StorageError(
            code === "EPERM" || code === "EACCES" ? "FILE_BUSY" : "REPLACE_FAILED",
            replacementError instanceof Error ? replacementError.message : "文件替换失败",
            replacementError
          );
        }
      }
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }

    const writtenStat = await stat(absolutePath);
    return {
      version: `${writtenStat.mtimeMs}:${writtenStat.size}`,
      modifiedAt: writtenStat.mtimeMs,
      size: writtenStat.size
    };
  }

  private async recoverStaleBackup(
    absolutePath: string,
    backupPath: string
  ): Promise<void> {
    try {
      await stat(backupPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    try {
      await stat(absolutePath);
      await unlink(backupPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await rename(backupPath, absolutePath);
    }
  }

  async stat(relativePath: string): Promise<StorageEntry | null> {
    try {
      const absolutePath = this.resolvePath(relativePath);
      const entryStat = await stat(absolutePath);
      return {
        path: relativePath.replaceAll("\\", "/"),
        name: basename(absolutePath),
        type: entryStat.isDirectory() ? "directory" : "file",
        size: entryStat.size,
        createdAt: entryStat.birthtimeMs,
        modifiedAt: entryStat.mtimeMs,
        version: `${entryStat.mtimeMs}:${entryStat.size}`
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    return (await this.stat(relativePath)) !== null;
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    const absoluteTargetPath = this.resolvePath(targetPath);
    await mkdir(dirname(absoluteTargetPath), { recursive: true });
    await rename(this.resolvePath(sourcePath), absoluteTargetPath);
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const absoluteTargetPath = this.resolvePath(targetPath);
    await mkdir(dirname(absoluteTargetPath), { recursive: true });
    await copyFile(this.resolvePath(sourcePath), absoluteTargetPath);
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.resolvePath(relativePath), { recursive: true, force: true });
  }

  async createDirectory(relativePath: string): Promise<void> {
    await mkdir(this.resolvePath(relativePath), { recursive: true });
  }

  async watch(
    relativePath: string,
    listener: (event: StorageWatchEvent) => void
  ): Promise<() => Promise<void> | void> {
    const watcher = chokidar.watch(this.resolvePath(relativePath), {
      ignoreInitial: true,
      ignored: (path) => {
        const relativePath = this.toRelativePath(path);
        return relativePath
          .split("/")
          .some(isExcludedDirectory);
      }
    });

    const emit = (type: StorageWatchEvent["type"], absolutePath: string): void => {
      listener({ type, path: this.toRelativePath(absolutePath) });
    };

    watcher.on("add", (path) => emit("created", path));
    watcher.on("change", (path) => emit("updated", path));
    watcher.on("unlink", (path) => emit("deleted", path));

    return async () => {
      await watcher.close();
    };
  }
}
