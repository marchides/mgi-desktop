import type { Attachment, AttachmentKind } from "./types";

/** File extensions we treat as inline text (no OCR / no PDF pipeline). */
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "xml", "yaml", "yml",
  "html", "htm", "css", "scss", "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "kts", "swift", "c", "h", "cpp",
  "hpp", "cs", "php", "sh", "bash", "zsh", "sql", "toml", "ini", "env",
  "log", "gitignore", "dockerfile",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function classifyFile(file: File): AttachmentKind {
  if (IMAGE_MIMES.has(file.type)) return "image";
  if (file.type === "application/pdf" || fileExt(file.name) === "pdf") return "pdf";
  const ext = fileExt(file.name);
  if (
    file.type.startsWith("text/") ||
    TEXT_EXTS.has(ext) ||
    file.type === "application/json" ||
    file.type === "application/xml"
  ) {
    return "text";
  }
  return "other";
}

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const SUPPORTED_MIMES = new Set([
  ...IMAGE_MIMES,
  "application/pdf",
]);

export function isFileSupported(file: File): boolean {
  const kind = classifyFile(file);
  if (kind === "other") return false;
  if (kind === "image") return IMAGE_MIMES.has(file.type);
  if (kind === "pdf") return SUPPORTED_MIMES.has("application/pdf");
  return true; // text/code
}

/**
 * Read a File into an Attachment. Images/PDFs are captured as data URLs;
 * text/code files are captured as plain text. Never persists on its own —
 * the caller decides whether to save the payload with the chat.
 */
export async function readAttachment(
  file: File,
  maxBytes: number,
): Promise<Attachment> {
  const kind = classifyFile(file);
  const base: Attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || guessMime(file.name, kind),
    size: file.size,
    kind,
  };
  if (file.size > maxBytes) {
    return {
      ...base,
      error: `File is larger than the ${humanSize(maxBytes)} limit.`,
    };
  }
  try {
    if (kind === "text") {
      const text = await file.text();
      return { ...base, textContent: text };
    }
    const dataUrl = await fileToDataUrl(file);
    return { ...base, dataUrl };
  } catch (e) {
    return { ...base, error: (e as Error).message || "Failed to read file." };
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Read error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function guessMime(name: string, kind: AttachmentKind): string {
  const ext = fileExt(name);
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") {
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  }
  if (kind === "text") return "text/plain";
  return "application/octet-stream";
}

/** Format a text/code attachment as a labelled block inserted into the prompt. */
export function formatTextAttachmentForPrompt(a: Attachment): string {
  const fence = "```";
  const lang = fileExt(a.name) || "";
  const body = a.textContent ?? "";
  return [
    `File: ${a.name}`,
    `Type: ${a.mime}`,
    `Content:`,
    `${fence}${lang}`,
    body,
    fence,
  ].join("\n");
}

/** Rough token estimate for text attachments (chars / 4). */
export function estimateAttachmentTokens(a: Attachment): number {
  if (a.textContent) return Math.ceil(a.textContent.length / 4);
  return 0;
}

/** Strip large payloads from an attachment so it's safe to save in localStorage. */
export function stripAttachmentPayload(a: Attachment): Attachment {
  return {
    id: a.id,
    name: a.name,
    mime: a.mime,
    size: a.size,
    kind: a.kind,
    error: a.error,
  };
}
