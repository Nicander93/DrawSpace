import { describe, expect, it } from "vitest";
import { placeGeneratedDiagram } from "@renderer/features/ai/DiagramPlacement";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const shape = (
  id: string,
  x: number,
  y: number,
  points?: readonly (readonly [number, number])[]
): ExcalidrawElement =>
  ({
    id,
    type: points ? "arrow" : "rectangle",
    x,
    y,
    width: 100,
    height: points ? 0 : 50,
    points: points ?? [
      [0, 0],
      [100, 0]
    ]
  }) as unknown as ExcalidrawElement;

describe("placeGeneratedDiagram", () => {
  it("空画布从 0,0 开始", () =>
    expect(placeGeneratedDiagram([shape("new", 10, 20)], [], {})[0]).toMatchObject({ x: 0, y: 0 }));

  it("无选区放到现有内容右侧", () =>
    expect(placeGeneratedDiagram([shape("new", 0, 0)], [shape("old", 10, 20)], {})[0]?.x).toBeGreaterThan(
      100
    ));

  it("有选区放到选区右侧并保持相对位置", () => {
    const result = placeGeneratedDiagram(
      [shape("a", 0, 0), shape("b", 200, 80)],
      [shape("old", 10, 20)],
      { old: true }
    );
    expect((result[1]?.x ?? 0) - (result[0]?.x ?? 0)).toBe(200);
    expect((result[1]?.y ?? 0) - (result[0]?.y ?? 0)).toBe(80);
  });

  it("不修改箭头 points", () => {
    const points = [
      [0, 0],
      [100, 0]
    ] as const;
    expect(
      (
        placeGeneratedDiagram([shape("arrow", 0, 0, points)], [], {})[0] as unknown as
          | { points: unknown }
          | undefined
      )?.points
    ).toEqual(points);
  });

  it("replace 锚定到选区左上角", () => {
    const result = placeGeneratedDiagram(
      [shape("a", 50, 50), shape("b", 150, 80)],
      [shape("old", 200, 100)],
      { old: true },
      "replace"
    );
    expect(result[0]).toMatchObject({ x: 200, y: 100 });
    expect(result[1]).toMatchObject({ x: 300, y: 130 });
  });

  it("replace 无选区时抛错", () => {
    expect(() =>
      placeGeneratedDiagram([shape("a", 0, 0)], [shape("old", 10, 20)], {}, "replace")
    ).toThrow("当前没有可替换的选区");
  });
});
