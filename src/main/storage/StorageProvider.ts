export interface StorageEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  createdAt?: number;
  modifiedAt?: number;
  version?: string;
}

export interface StorageWriteResult {
  version: string;
  modifiedAt: number;
  size: number;
}

export interface StorageWatchEvent {
  type: "created" | "updated" | "deleted" | "renamed";
  path: string;
  oldPath?: string;
}

export interface StorageProvider {
  readonly type: string;
  initialize(): Promise<void>;
  list(
    path: string,
    options?: {
      recursive?: boolean;
      cursor?: string;
      limit?: number;
    }
  ): Promise<{
    entries: StorageEntry[];
    nextCursor?: string;
  }>;
  read(path: string): Promise<Uint8Array>;
  write(
    path: string,
    data: Uint8Array,
    options?: {
      expectedVersion?: string;
      contentType?: string;
    }
  ): Promise<StorageWriteResult>;
  stat(path: string): Promise<StorageEntry | null>;
  exists(path: string): Promise<boolean>;
  move(sourcePath: string, targetPath: string): Promise<void>;
  copy(sourcePath: string, targetPath: string): Promise<void>;
  delete(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  watch?(
    path: string,
    listener: (event: StorageWatchEvent) => void
  ): Promise<() => Promise<void> | void>;
}
