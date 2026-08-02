import type { AiImageUpload } from "@shared/types";

export const AI_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const AI_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function validateAiImage(image: AiImageUpload): void {
  if (!AI_IMAGE_MIME_TYPES.includes(image.mimeType)) throw new Error("只支持 PNG、JPEG 或 WEBP 图片");
  if (image.data.byteLength <= 0) throw new Error("图片文件为空");
  if (image.data.byteLength > AI_IMAGE_MAX_BYTES) throw new Error("单张图片不能超过 8 MB");
}
