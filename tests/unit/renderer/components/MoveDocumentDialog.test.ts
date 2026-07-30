import { describe, expect, test } from "vitest";
import { buildDirectoryTree } from "@renderer/components/MoveDocumentDialog";


describe("buildDirectoryTree", () => {
  test("builds nested folders once and preserves the root choice separately", () => {
    expect(buildDirectoryTree(["Design/Marketing", "Design/Product", "Archive"]))
      .toEqual([
        { name: "Design", path: "Design", children: [
          { name: "Marketing", path: "Design/Marketing", children: [] },
          { name: "Product", path: "Design/Product", children: [] }
        ] },
        { name: "Archive", path: "Archive", children: [] }
      ]);
  });

  test("ignores empty path parts", () => {
    expect(buildDirectoryTree(["/Design//Product/"])).toEqual([
      { name: "Design", path: "Design", children: [
        { name: "Product", path: "Design/Product", children: [] }
      ] }
    ]);
  });
});
