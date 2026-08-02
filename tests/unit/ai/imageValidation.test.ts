import { describe, expect, it } from "vitest";
import { validateAiImage } from "@main/services/ai/imageValidation";

const image = (mimeType: "image/png" | "image/jpeg" | "image/webp", bytes: number) => ({ fileName: "user/unsafe.png", mimeType, data: new ArrayBuffer(bytes) });

describe("validateAiImage", () => {
  it("接受支持的图片并拒绝 SVG、空文件和超大文件", () => {
    expect(() => validateAiImage(image("image/png", 1))).not.toThrow();
    expect(() => validateAiImage({ ...image("image/png", 1), mimeType: "image/svg+xml" as never })).toThrow();
    expect(() => validateAiImage(image("image/png", 0))).toThrow();
    expect(() => validateAiImage(image("image/png", 8 * 1024 * 1024 + 1))).toThrow();
  });
});
