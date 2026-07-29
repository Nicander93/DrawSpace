export type StorageErrorCode =
  | "VERSION_CONFLICT"
  | "FILE_BUSY"
  | "PERMISSION_DENIED"
  | "REPLACE_FAILED"
  | "IO_ERROR";

export class StorageError extends Error {
  public constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}
