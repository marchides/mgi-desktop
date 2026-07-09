/**
 * Model capability metadata. Kept intentionally small and honest —
 * we only claim what we know a model supports on OpenRouter today.
 * Unknown models fall through to `unknown` so the UI can warn the user
 * before sending non-text attachments.
 */

export interface ModelCapability {
  text: boolean;
  image: boolean;
  pdf: boolean;
  audio: boolean;
  video: boolean;
}

export const UNKNOWN_CAPABILITY: ModelCapability = {
  text: true,
  image: false,
  pdf: false,
  audio: false,
  video: false,
};

const CAPS: Record<string, ModelCapability> = {
  "z-ai/glm-5.2": { text: true, image: false, pdf: false, audio: false, video: false },
  "z-ai/glm-5.2:floor": { text: true, image: false, pdf: false, audio: false, video: false },
  "z-ai/glm-5.1": { text: true, image: false, pdf: false, audio: false, video: false },
  "z-ai/glm-4.6": { text: true, image: false, pdf: false, audio: false, video: false },
  "z-ai/glm-5v-turbo": { text: true, image: true, pdf: false, audio: false, video: true },
};

/** Preferred vision model when the user tries to attach an image on a text model. */
export const DEFAULT_VISION_MODEL = "z-ai/glm-5v-turbo";

export function getCapability(modelId: string): {
  cap: ModelCapability;
  known: boolean;
} {
  const cap = CAPS[modelId];
  if (cap) return { cap, known: true };
  return { cap: UNKNOWN_CAPABILITY, known: false };
}
