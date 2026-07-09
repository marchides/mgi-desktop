import type { ChatMessage } from "./types";
import { CONTEXT_WINDOW_TOKENS, SAFETY_BUFFER } from "./types";

// Rough heuristic: ~4 chars/token. Good enough for UI clamping.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  systemPrompt: string,
  messages: Pick<ChatMessage, "role" | "content">[],
): number {
  let total = estimateTokens(systemPrompt);
  for (const m of messages) {
    total += estimateTokens(m.content) + 4; // per-message overhead
  }
  return total + 8;
}

export function availableOutputTokens(inputTokens: number): number {
  return Math.max(256, CONTEXT_WINDOW_TOKENS - inputTokens - SAFETY_BUFFER);
}

export function resolveMaxTokens(
  selected: number | "max",
  inputTokens: number,
): number {
  const avail = availableOutputTokens(inputTokens);
  if (selected === "max") return avail;
  return Math.min(selected, avail);
}
