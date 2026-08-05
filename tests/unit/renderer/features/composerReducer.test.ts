import { describe, expect, it } from "vitest";
import { aiComposerReducer, initialAiComposerState } from "../../../../src/renderer/src/features/ai/model/composerReducer";

describe("aiComposerReducer", () => {
  it("turns off selection appearance when selection context is removed", () => {
    const withSelection = aiComposerReducer(initialAiComposerState, { type: "use-selection", enabled: true });
    const withAppearance = aiComposerReducer(withSelection, { type: "include-selection-appearance", enabled: true });
    const withoutSelection = aiComposerReducer(withAppearance, { type: "use-selection", enabled: false });

    expect(withoutSelection.context.useSelection).toBe(false);
    expect(withoutSelection.context.includeSelectionAppearance).toBe(false);
  });

  it("clears draft and context after a successful send", () => {
    const state = aiComposerReducer(
      { ...initialAiComposerState, draft: "补充缓存层", context: { ...initialAiComposerState.context, baseTurnId: "turn-1", useSelection: true } },
      { type: "reset-after-send" }
    );

    expect(state.draft).toBe("");
    expect(state.context.baseTurnId).toBeUndefined();
    expect(state.context.useSelection).toBe(false);
  });
});
