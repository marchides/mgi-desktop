import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUp,
  Copy,
  FileText,
  ImageIcon,
  Menu,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Square,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { MgiLogo } from "@/components/mgi/MgiLogo";
import { MarkdownMessage } from "@/components/mgi/MarkdownMessage";
import { useConversations, useSettings } from "@/lib/mgi/store";
import type { Attachment, ChatMessage, Conversation } from "@/lib/mgi/types";
import {
  buildOpenRouterBody,
  estimateAttachmentsTokens,
  streamChatCompletion,
} from "@/lib/mgi/openrouter";
import {
  humanSize,
  isFileSupported,
  readAttachment,
  stripAttachmentPayload,
} from "@/lib/mgi/attachments";
import { getCapability } from "@/lib/mgi/models";
import { estimateMessagesTokens } from "@/lib/mgi/tokens";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Monty's GLM Interface — MGI" },
      { name: "description", content: "A mobile-first GLM chat client for OpenRouter." },
      { property: "og:title", content: "Monty's GLM Interface — MGI" },
      { property: "og:description", content: "A mobile-first GLM chat client for OpenRouter." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { settings, update } = useSettings();
  const {
    conversations,
    activeId,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
    renameConversation,
  } = useConversations();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pendingAtts, setPendingAtts] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const active = useMemo<Conversation | null>(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // Auto-scroll on new content
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages, streamingId]);

  const ensureConversation = (): Conversation => {
    if (active) return active;
    return createConversation();
  };

  const hasKey = settings.apiKey.trim().length > 0;
  const capability = getCapability(settings.model);
  const totalPendingBytes = pendingAtts.reduce((n, a) => n + a.size, 0);
  const pendingImageOnTextModel =
    capability.known &&
    !capability.cap.image &&
    pendingAtts.some((a) => a.kind === "image" && !a.error);
  const pendingPdfOnNoPdfModel =
    capability.known &&
    !capability.cap.pdf &&
    pendingAtts.some((a) => a.kind === "pdf" && !a.error);

  // ---- Warnings ----
  const attachmentTextTokens = estimateAttachmentsTokens(pendingAtts);
  const inputTokensEstimate =
    (active
      ? estimateMessagesTokens(settings.systemPrompt, active.messages)
      : estimateMessagesTokens(settings.systemPrompt, [])) + attachmentTextTokens;
  const bigContext = inputTokensEstimate > 200_000;
  const bigOutput =
    settings.params.max_output_tokens !== "max" &&
    (settings.params.max_output_tokens as number) > 65_536;
  const bigAttachments =
    settings.warnLargeAttachments && totalPendingBytes > 5 * 1024 * 1024;

  // ---- Attachments ----
  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!settings.enableAttachments) {
      toast.error("Attachments are disabled in Settings.");
      return;
    }
    const incoming: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!isFileSupported(file)) {
        toast.error(`${file.name}: unsupported file type.`);
        continue;
      }
      const att = await readAttachment(file, settings.maxAttachmentBytes);
      if (att.error) toast.error(`${att.name}: ${att.error}`);
      incoming.push(att);
    }
    setPendingAtts((prev) => [...prev, ...incoming]);
  }

  function removePending(id: string) {
    setPendingAtts((prev) => prev.filter((a) => a.id !== id));
  }

  function switchToVisionModel() {
    update({ model: settings.visionModel });
    toast.success(`Switched to ${settings.visionModel}`);
  }

  // ---- Send / stream ----
  async function sendMessage(text: string, attachments: Attachment[] = []) {
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) return;
    if (!hasKey) {
      toast.error("Add your OpenRouter API key in Settings.");
      return;
    }

    // Model capability gate for images.
    if (attachments.some((a) => a.kind === "image" && !a.error)) {
      const { cap, known } = getCapability(settings.model);
      if (known && !cap.image) {
        toast.error(
          "This model doesn't support image input. Switch to a vision model?",
          {
            action: {
              label: `Use ${settings.visionModel}`,
              onClick: switchToVisionModel,
            },
          },
        );
        return;
      }
      if (!known) {
        toast.warning(
          "Model capability unknown — sending image anyway. It may be rejected.",
        );
      }
    }

    const conv = ensureConversation();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedText,
      createdAt: Date.now(),
      attachments: attachments.length ? attachments : undefined,
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    updateConversation(conv.id, (c) => ({
      ...c,
      title:
        c.messages.length === 0
          ? deriveTitle(trimmedText || attachments[0]?.name || "New chat")
          : c.title,
      messages: [...c.messages, userMsg, assistantMsg],
    }));
    setInput("");
    setPendingAtts([]);
    setStreamingId(assistantMsg.id);

    const history = [...conv.messages, userMsg];
    const { body } = buildOpenRouterBody({ settings, messages: history });

    const ac = new AbortController();
    abortRef.current = ac;

    let acc = "";
    let reasoning = "";
    const finalizeAttachments = () => {
      if (settings.saveAttachmentsInHistory || attachments.length === 0) return;
      updateConversation(conv.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === userMsg.id
            ? {
                ...m,
                attachments: m.attachments?.map(stripAttachmentPayload),
              }
            : m,
        ),
      }));
    };

    await streamChatCompletion(settings.apiKey, body, {
      signal: ac.signal,
      onDelta: (t) => {
        acc += t;
        updateConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: acc } : m,
          ),
        }));
      },
      onReasoning: (t) => {
        reasoning += t;
        updateConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, reasoning } : m,
          ),
        }));
      },
      onUsage: (usage) => {
        updateConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, usage } : m,
          ),
        }));
      },
      onDone: () => {
        finalizeAttachments();
        setStreamingId(null);
        abortRef.current = null;
      },
      onError: (err) => {
        updateConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, error: err.message, content: acc }
              : m,
          ),
        }));
        finalizeAttachments();
        setStreamingId(null);
        abortRef.current = null;
        toast.error(err.message);
      },
    });
  }

  function stop() {
    abortRef.current?.abort();
  }

  function regenerate() {
    if (!active) return;
    // Drop trailing assistant, resend last user
    const msgs = [...active.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "user") return;
    updateConversation(active.id, (c) => ({ ...c, messages: msgs.slice(0, -1) }));
    setTimeout(() => sendMessage(last.content), 0);
  }

  function submitEdit(id: string) {
    if (!active) return;
    const idx = active.messages.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const truncated = active.messages.slice(0, idx);
    updateConversation(active.id, (c) => ({ ...c, messages: truncated }));
    setEditingMsgId(null);
    setTimeout(() => sendMessage(editDraft), 0);
  }

  function clearCurrent() {
    if (!active) return;
    if (!confirm("Clear all messages in this chat?")) return;
    updateConversation(active.id, (c) => ({ ...c, messages: [] }));
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-12 items-center gap-1.5 px-2 sm:h-14 sm:gap-2 sm:px-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"
          aria-label="Open conversations"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MgiLogo size={24} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight">
              {active?.title ?? "Monty's GLM Interface"}
            </div>
            <div className="truncate text-[10px] leading-tight text-muted-foreground">
              {settings.model} · {settings.routingMode}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            createConversation();
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"
          aria-label="New chat"
        >
          <Plus className="h-5 w-5" />
        </button>
        <Link
          to="/settings"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
        </div>
      </header>


      {/* Warnings */}
      {(bigContext || bigOutput || !hasKey || bigAttachments || pendingImageOnTextModel || pendingPdfOnNoPdfModel) && (
        <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
          {!hasKey && <p>⚠ Add your OpenRouter API key in Settings to start chatting.</p>}
          {bigContext && <p>⚠ Large context may be slow and expensive.</p>}
          {bigOutput && <p>⚠ Very large outputs can be slow and costly.</p>}
          {bigAttachments && (
            <p>⚠ Large attachments ({humanSize(totalPendingBytes)}) can raise cost and latency.</p>
          )}
          {pendingImageOnTextModel && (
            <p>
              ⚠ {settings.model} may not support images.{" "}
              <button
                onClick={switchToVisionModel}
                className="underline hover:text-foreground"
              >
                Switch to {settings.visionModel}
              </button>
            </p>
          )}
          {pendingPdfOnNoPdfModel && (
            <p>⚠ {settings.model} may not support PDFs. The provider may reject the file.</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="mgi-scroll flex-1 overflow-y-auto px-3 py-3 sm:py-4">

        {!active || active.messages.length === 0 ? (
          <EmptyState onPick={(t) => setInput(t)} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {active.messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                streaming={streamingId === m.id}
                editing={editingMsgId === m.id}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                onStartEdit={() => {
                  setEditingMsgId(m.id);
                  setEditDraft(m.content);
                }}
                onCancelEdit={() => setEditingMsgId(null)}
                onSubmitEdit={() => submitEdit(m.id)}
              />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {streamingId ? (
                <button
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
              ) : (
                active.messages.some((m) => m.role === "assistant") && (
                  <button
                    onClick={regenerate}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                )
              )}
              <button
                onClick={clearCurrent}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <div className="mx-auto max-w-2xl space-y-2">
          {pendingAtts.length > 0 && (
            <AttachmentStrip
              atts={pendingAtts}
              onRemove={removePending}
              onClearAll={() => setPendingAtts([])}
            />
          )}
          <div className="mgi-composer flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf,text/*,.md,.json,.csv,.html,.css,.js,.jsx,.ts,.tsx,.py"
              onChange={(e) => {
                void onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => {
                if (!settings.enableAttachments) {
                  toast.error("Attachments are disabled in Settings.");
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Attach files"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter to send only when not composing; Shift+Enter = newline
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage(input, pendingAtts);
                }
              }}
              rows={1}
              placeholder={hasKey ? "Message GLM..." : "Add API key in Settings"}
              className="mgi-scroll min-h-[38px] max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
              style={{ lineHeight: 1.4 }}
            />

            <button
              onClick={() => sendMessage(input, pendingAtts)}
              disabled={
                !hasKey ||
                (!input.trim() && pendingAtts.length === 0) ||
                !!streamingId
              }
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition",
                !hasKey || (!input.trim() && pendingAtts.length === 0) || !!streamingId
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              )}
              aria-label="Send"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
          <div className="pt-1.5 text-center text-[10px] text-muted-foreground">
            Monty's GLM Interface · MGI v1.0
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 flex h-full w-[85%] max-w-sm flex-col border-r border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <MgiLogo size={26} />
              <div className="flex-1 text-sm font-semibold">Conversations</div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  createConversation();
                  setSidebarOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> New chat
              </button>
            </div>
            <div className="px-2 pb-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="mgi-scroll flex-1 overflow-y-auto px-2 pb-3">
              {filtered.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No conversations yet.
                </p>
              )}
              {filtered.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onOpen={() => {
                    setActiveId(c.id);
                    setSidebarOpen(false);
                  }}
                  onRename={(t) => renameConversation(c.id, t)}
                  onDelete={() => deleteConversation(c.id)}
                />
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function deriveTitle(text: string): string {
  const t = text.trim().split("\n")[0].slice(0, 48);
  return t.length ? t : "New chat";
}

function EmptyState({ onPick: _onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-6 text-center sm:gap-5 sm:pt-10">
      <span className="sm:hidden">
        <MgiLogo size={56} />
      </span>
      <span className="hidden sm:block">
        <MgiLogo size={72} />
      </span>
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          Monty's GLM Interface
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with GLM through your own OpenRouter key.
        </p>
      </div>
    </div>
  );
}


interface BubbleProps {
  m: ChatMessage;
  streaming: boolean;
  editing: boolean;
  editDraft: string;
  setEditDraft: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
}

function MessageBubble({
  m,
  streaming,
  editing,
  editDraft,
  setEditDraft,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
}: BubbleProps) {
  const time = new Date(m.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const copy = () => {
    navigator.clipboard.writeText(m.content);
    toast.success("Copied");
  };
  const isUser = m.role === "user";

  return (
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[15px]",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm",
        )}
      >
        {editing ? (
          <div className="flex flex-col gap-2 min-w-[240px]">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="min-h-24 w-full rounded-lg bg-background/40 p-2 text-sm text-foreground outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancelEdit}
                className="rounded-md px-2 py-1 text-xs hover:bg-black/10"
              >
                Cancel
              </button>
              <button
                onClick={onSubmitEdit}
                className="rounded-md bg-background/20 px-2 py-1 text-xs font-medium"
              >
                Send
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="flex flex-col gap-2">
            {m.content && (
              <p className="mgi-user-bubble whitespace-pre-wrap">{m.content}</p>
            )}
            {m.attachments && m.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.attachments.map((a) => (
                  <AttachmentChip key={a.id} a={a} compact />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {m.reasoning && (
              <details className="mb-1.5 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Reasoning</summary>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-snug">
                  {m.reasoning}
                </pre>
              </details>
            )}
            {m.content ? (
              <MarkdownMessage content={m.content} streaming={streaming} />
            ) : streaming ? (
              <span className="mgi-cursor text-muted-foreground text-sm">Thinking</span>
            ) : null}
            {m.error && (
              <p className="mt-2 text-xs text-destructive">{m.error}</p>
            )}
          </>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 px-1 text-[10px] text-muted-foreground",
          isUser ? "flex-row-reverse" : "",
        )}
      >
        <span>{time}</span>
        {m.usage?.total_tokens != null && (
          <span>· {m.usage.total_tokens} tok</span>
        )}
        {!editing && (
          <>
            <button onClick={copy} className="hover:text-foreground" aria-label="Copy">
              <Copy className="h-3 w-3" />
            </button>
            {isUser && (
              <button
                onClick={onStartEdit}
                className="hover:text-foreground"
                aria-label="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  c,
  active,
  onOpen,
  onRename,
  onDelete,
}: {
  c: Conversation;
  active: boolean;
  onOpen: () => void;
  onRename: (t: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(c.title);
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-2 text-sm",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
    >
      {renaming ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(draft || "Untitled");
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            className="flex-1 bg-transparent outline-none"
          />
          <button
            onClick={() => {
              onRename(draft || "Untitled");
              setRenaming(false);
            }}
            className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left">
            {c.title}
          </button>
          <button
            onClick={() => setRenaming(true)}
            className="grid h-7 w-7 place-items-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function AttachmentStrip({
  atts,
  onRemove,
  onClearAll,
}: {
  atts: Attachment[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex flex-1 flex-wrap gap-1.5">
        {atts.map((a) => (
          <AttachmentChip key={a.id} a={a} onRemove={() => onRemove(a.id)} />
        ))}
      </div>
      {atts.length > 1 && (
        <button
          onClick={onClearAll}
          className="shrink-0 rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function AttachmentChip({
  a,
  onRemove,
  compact,
}: {
  a: Attachment;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const Icon = a.kind === "image" ? ImageIcon : FileText;
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs",
        compact && "bg-background/40",
        a.error && "border-destructive/60",
      )}
      title={a.error ?? `${a.name} · ${humanSize(a.size)}`}
    >
      {a.kind === "image" && a.dataUrl ? (
        <img
          src={a.dataUrl}
          alt=""
          className="h-6 w-6 rounded object-cover"
        />
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate max-w-[160px] font-medium">{a.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {a.kind.toUpperCase()} · {humanSize(a.size)}
          {a.error ? ` · ${a.error}` : ""}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${a.name}`}
          className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
