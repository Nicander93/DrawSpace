import type { AiImageUpload } from "@shared/types";

export interface PendingImage extends AiImageUpload {
  previewUrl: string;
}

export interface AiComposerContext {
  baseTurnId?: string;
  useSelection: boolean;
  includeSelectionAppearance: boolean;
  images: PendingImage[];
}

export interface AiComposerState {
  draft: string;
  context: AiComposerContext;
  submitting: boolean;
}

export type AiComposerAction =
  | { type: "set-draft"; value: string }
  | { type: "use-selection"; enabled: boolean }
  | { type: "include-selection-appearance"; enabled: boolean }
  | { type: "use-base-turn"; turnId?: string }
  | { type: "add-image"; image: PendingImage }
  | { type: "remove-image"; image: PendingImage }
  | { type: "reset-after-send" }
  | { type: "set-submitting"; value: boolean };

export const initialAiComposerState: AiComposerState = {
  draft: "",
  context: { useSelection: false, includeSelectionAppearance: false, images: [] },
  submitting: false
};

export const aiComposerReducer = (state: AiComposerState, action: AiComposerAction): AiComposerState => {
  switch (action.type) {
    case "set-draft":
      return { ...state, draft: action.value };
    case "use-selection":
      return { ...state, context: { ...state.context, useSelection: action.enabled, includeSelectionAppearance: action.enabled ? state.context.includeSelectionAppearance : false } };
    case "include-selection-appearance":
      return { ...state, context: { ...state.context, includeSelectionAppearance: action.enabled } };
    case "use-base-turn":
      return { ...state, context: { ...state.context, baseTurnId: action.turnId } };
    case "add-image":
      return {
        ...state,
        context: {
          ...state.context,
          includeSelectionAppearance: false,
          images: [action.image]
        }
      };
    case "remove-image":
      return { ...state, context: { ...state.context, images: state.context.images.filter((image) => image !== action.image) } };
    case "reset-after-send":
      return { ...state, draft: "", context: { useSelection: false, includeSelectionAppearance: false, images: [] } };
    case "set-submitting":
      return { ...state, submitting: action.value };
  }
};
