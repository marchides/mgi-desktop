import type {
  AppSettings,
  Attachment,
  ChatMessage,
  ModelParameters,
  RoutingMode,
} from "./types";
import { resolveMaxTokens, estimateMessagesTokens } from "./tokens";
import { formatTextAttachmentForPrompt } from "./attachments";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

interface BuildOptions {
  settings: AppSettings;
  messages: ChatMessage[]; // ordered, user+assistant only
  systemPromptOverride?: string;
}

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type FilePart = {
  type: "file";
  file: { filename: string; file_data: string };
};
type ContentPart = TextPart | ImagePart | FilePart;

/**
 * Central request builder. Returns the JSON body to POST to OpenRouter,
 * plus computed metadata for UI display.
 */
export function buildOpenRouterBody({
  settings,
  messages,
  systemPromptOverride,
}: BuildOptions) {
  const system = systemPromptOverride ?? settings.systemPrompt;
  const trimmed = applyHistoryMode(messages, settings);

  const payloadMessages: { role: string; content: string | ContentPart[] }[] = [];
  if (system.trim()) payloadMessages.push({ role: "system", content: system });
  for (const m of trimmed) {
    payloadMessages.push({ role: m.role, content: buildMessageContent(m) });
  }

  const inputTokens = estimateMessagesTokens(system, trimmed);
  const max_tokens = resolveMaxTokens(settings.params.max_output_tokens, inputTokens);

  const providerRouting = buildProviderRouting(settings.routingMode);
  const routedModel = routeModel(settings.model, settings.routingMode);

  const body: Record<string, unknown> = {
    model: routedModel,
    messages: payloadMessages,
    stream: true,
    max_tokens,
    ...paramFields(settings.params),
    ...(providerRouting ? { provider: providerRouting } : {}),
    reasoning: {
      effort: settings.params.reasoning_effort,
      exclude: !settings.params.include_reasoning,
    },
    usage: { include: true },
  };

  return { body, inputTokens, max_tokens };
}

/**
 * Turn a ChatMessage into either a plain string (fastest, most compatible)
 * or an OpenRouter multimodal content array. Text/code attachments are
 * concatenated as labelled blocks; images/PDFs are emitted as typed parts.
 */
function buildMessageContent(m: ChatMessage): string | ContentPart[] {
  const attachments = m.attachments ?? [];
  const usable = attachments.filter((a) => !a.error);
  if (usable.length === 0) return m.content;

  const textBlocks: string[] = [];
  if (m.content.trim()) textBlocks.push(m.content);
  const mediaParts: ContentPart[] = [];

  for (const a of usable) {
    if (a.kind === "text" && a.textContent != null) {
      textBlocks.push(formatTextAttachmentForPrompt(a));
    } else if (a.kind === "image" && a.dataUrl) {
      mediaParts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else if (a.kind === "pdf" && a.dataUrl) {
      mediaParts.push({
        type: "file",
        file: { filename: a.name, file_data: a.dataUrl },
      });
    } else {
      // Payload not present (e.g. re-sent from stripped history) — mention it.
      textBlocks.push(`[Attachment omitted: ${a.name} (${a.mime})]`);
    }
  }

  if (mediaParts.length === 0) return textBlocks.join("\n\n");
  const parts: ContentPart[] = [];
  const joined = textBlocks.join("\n\n");
  if (joined) parts.push({ type: "text", text: joined });
  parts.push(...mediaParts);
  return parts;
}

/** Estimate extra input tokens from text/code attachments. */
export function estimateAttachmentsTokens(attachments: Attachment[]): number {
  let total = 0;
  for (const a of attachments) {
    if (a.textContent) total += Math.ceil(a.textContent.length / 4);
  }
  return total;
}

function paramFields(p: ModelParameters) {
  const out: Record<string, number> = {
    temperature: p.temperature,
    top_p: p.top_p,
    frequency_penalty: p.frequency_penalty,
    presence_penalty: p.presence_penalty,
    repetition_penalty: p.repetition_penalty,
  };
  if (p.top_k > 0) out.top_k = p.top_k;
  return out;
}

function routeModel(model: string, mode: RoutingMode): string {
  if (mode === "cheapest" && model === "z-ai/glm-5.2") return "z-ai/glm-5.2:floor";
  return model;
}

function buildProviderRouting(mode: RoutingMode) {
  if (mode === "balanced") return null;
  if (mode === "cheapest") {
    return {
      sort: "price",
      max_price: { prompt: 1.0, completion: 3.2 },
    };
  }
  if (mode === "fastest") {
    return { sort: "throughput" };
  }
  return null;
}

function applyHistoryMode(messages: ChatMessage[], settings: AppSettings): ChatMessage[] {
  if (settings.historyMode === "full") return messages;
  if (settings.historyMode === "recent") {
    return messages.slice(-Math.max(2, settings.recentCount));
  }
  // trim: rough char-budget trim from the front, keep last exchange intact
  const BUDGET_CHARS = 200_000;
  const out: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    out.unshift(messages[i]);
    if (total > BUDGET_CHARS) break;
  }
  return out;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
  onUsage?: (usage: ChatMessage["usage"]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

export async function streamChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
  cb: StreamCallbacks,
) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    cb.onError(new Error("You are offline. Chat requires internet."));
    return;
  }
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(body),
      // Belt & braces — even though our SW never intercepts cross-origin
      // requests, bypass any browser HTTP cache for streaming completions.
      cache: "no-store",
      signal: cb.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(friendlyError(res.status, text));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) cb.onDelta(delta.content);
          if (delta?.reasoning && cb.onReasoning) cb.onReasoning(delta.reasoning);
          if (json.usage && cb.onUsage) cb.onUsage(json.usage);
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }
    cb.onDone();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      cb.onDone();
      return;
    }
    cb.onError(err as Error);
  }
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      typeof window !== "undefined" ? window.location.origin : "https://mgi.app",
    "X-Title": "Monty's GLM Interface (MGI)",
  };
}

function friendlyError(status: number, body: string): string {
  if (status === 401) return "Invalid OpenRouter API key. Check it in Settings.";
  if (status === 402) return "OpenRouter credits exhausted. Top up your account.";
  if (status === 429) return "Rate limited. Wait a moment and try again.";
  if (status >= 500) return "OpenRouter is having trouble. Try again shortly.";
  // Try to pull a message out of the JSON error body
  try {
    const j = JSON.parse(body);
    const msg = j?.error?.message || j?.message;
    if (msg) return String(msg);
  } catch {
    /* noop */
  }
  return `Request failed (${status}).`;
}

export async function verifyApiKey(apiKey: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!apiKey.trim()) return { ok: false, message: "No API key provided." };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, message: "You are offline. Chat requires internet." };
  }
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) return { ok: false, message: "Invalid API key." };
    if (!res.ok) return { ok: false, message: `Verification failed (${res.status}).` };
    return { ok: true, message: "API key verified." };
  } catch (e) {
    return { ok: false, message: (e as Error).message || "Network error." };
  }
}
