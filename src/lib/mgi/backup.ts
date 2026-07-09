/**
 * Local backup / export / import for MGI.
 *
 * All data stays on-device. These helpers only read from localStorage,
 * write to a Blob download, or read a user-picked file. No network calls.
 */
import type { Conversation } from "./types";
import { stripAttachmentPayload } from "./attachments";

const SETTINGS_KEY = "mgi:settings:v1";
const CONVERSATIONS_KEY = "mgi:conversations:v1";
const ACTIVE_KEY = "mgi:active-conversation:v1";

const EXPORT_VERSION = 1;

export interface ExportBundle {
  app: "mgi";
  version: number;
  exportedAt: string;
  conversations: Conversation[];
}

function readConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? "[]") as Conversation[];
  } catch {
    return [];
  }
}

function writeConversations(list: Conversation[]) {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportAllConversationsJSON(): number {
  const conversations = readConversations();
  const bundle: ExportBundle = {
    app: "mgi",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    conversations,
  };
  downloadFile(
    `mgi-chats-${timestamp()}.json`,
    JSON.stringify(bundle, null, 2),
    "application/json",
  );
  return conversations.length;
}

export type ImportMode = "merge" | "replace";

export interface ImportResult {
  imported: number;
  total: number;
}

export function importConversationsJSON(text: string, mode: ImportMode): ImportResult {
  const parsed = JSON.parse(text) as ExportBundle | Conversation[];
  const incoming: Conversation[] = Array.isArray(parsed)
    ? parsed
    : parsed?.conversations ?? [];

  if (!Array.isArray(incoming)) throw new Error("Invalid backup file: no conversations array.");

  // Basic validation + light sanitation of attachment payloads.
  const clean: Conversation[] = incoming
    .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
    .map((c) => ({
      ...c,
      title: c.title ?? "Imported chat",
      createdAt: c.createdAt ?? Date.now(),
      updatedAt: c.updatedAt ?? Date.now(),
      messages: c.messages.map((m) => ({
        ...m,
        attachments: m.attachments?.map(stripAttachmentPayload),
      })),
    }));

  const existing = mode === "replace" ? [] : readConversations();
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of clean) byId.set(c.id, c);
  const merged = Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  writeConversations(merged);
  return { imported: clean.length, total: merged.length };
}

export function exportConversationMarkdown(c: Conversation): void {
  const lines: string[] = [];
  lines.push(`# ${c.title || "Untitled chat"}`);
  lines.push("");
  lines.push(`_Exported from MGI · ${new Date().toISOString()}_`);
  lines.push("");
  for (const m of c.messages) {
    const who =
      m.role === "user" ? "You" : m.role === "assistant" ? "Assistant" : "System";
    lines.push(`## ${who}`);
    lines.push("");
    if (m.attachments?.length) {
      for (const a of m.attachments) {
        lines.push(`- 📎 \`${a.name}\` (${a.mime})`);
      }
      lines.push("");
    }
    lines.push(m.content || "");
    lines.push("");
  }
  const safe = (c.title || "chat").replace(/[^\w-]+/g, "-").slice(0, 40) || "chat";
  downloadFile(
    `mgi-${safe}-${timestamp()}.md`,
    lines.join("\n"),
    "text/markdown",
  );
}

/** Wipes every MGI-owned localStorage key. Does not touch other origins. */
export function clearAllLocalData(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("mgi:")) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  // Belt & braces:
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(CONVERSATIONS_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}

export async function pickJSONFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(await file.text());
    };
    input.click();
  });
}
