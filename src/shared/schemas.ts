import { z } from "zod";

export const documentIdSchema = z.string().uuid();

export const workspaceProviderTypeSchema = z.enum(["local", "nutstore"]);

export const documentListQuerySchema = z.object({
  filter: z.enum(["home", "recent", "favorites", "all", "trash"]),
  search: z.string().max(200).optional(),
  sort: z
    .enum(["lastOpened", "modified", "nameAsc", "nameDesc", "created"])
    .optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
});

export const relativeDirectorySchema = z
  .string()
  .max(500)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !value.split(/[\\/]/).includes(".."),
    "目录必须位于当前工作区内"
  )
  .refine(
    (value) =>
      value
        .split(/[\\/]/)
        .filter(Boolean)
        .every(
          (part) =>
            !part.startsWith(".") &&
            !["node_modules", ".canvasdesk", ".git"].includes(part.toLowerCase())
        ),
    "不能使用隐藏目录或内部管理目录"
  );

export const fileNameSchema = z
  .string()
  .trim()
  .min(1, "名称不能为空")
  .max(180, "名称不能超过 180 个字符")
  .refine((value) => !/[<>:"/\\|?*\u0000-\u001f]/.test(value), "名称包含非法字符")
  .refine((value) => !/[. ]$/.test(value), "名称不能以点或空格结尾");

export const excalidrawFileSchema = z.object({
  type: z.literal("excalidraw"),
  version: z.number(),
  source: z.string().default("https://excalidraw.com"),
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()).default({}),
  files: z.record(z.string(), z.unknown()).default({})
});

export const saveDocumentInputSchema = z.object({
  documentId: documentIdSchema,
  sceneData: excalidrawFileSchema,
  expectedVersion: z.string().min(1)
});

export const recoverySnapshotSchema = z.object({
  documentId: documentIdSchema,
  sourcePath: z.string().min(1),
  savedAt: z.number(),
  sourceModifiedAt: z.number(),
  sceneData: excalidrawFileSchema,
  sessionId: z.string().uuid()
});

export const importBufferSchema = z.object({
  fileName: z.string().min(1).max(260),
  data: z.instanceof(ArrayBuffer).refine((data) => data.byteLength <= 50 * 1024 * 1024)
});

export const exportAssetSchema = z.object({
  documentId: documentIdSchema,
  format: z.enum(["png", "svg"]),
  data: z.union([z.instanceof(ArrayBuffer), z.string()])
});
