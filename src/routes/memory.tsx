import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Download,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { MgiLogo } from "@/components/mgi/MgiLogo";
import { useMemories, type MemoryRecord } from "@/lib/mgi/memory";
import { downloadFile, pickJSONFile } from "@/lib/mgi/backup";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [{ title: "Memory — MGI" }],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const navigate = useNavigate();
  const {
    memories,
    addMemory,
    updateMemory,
    deleteMemory,
    togglePin,
    clearAll,
    importMemories,
  } = useMemories();

  const [search, setSearch] = useState("");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPinned, setNewPinned] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const close = () => navigate({ to: "/" });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? memories.filter(
          (m) =>
            m.text.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q),
        )
      : memories.slice();
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [memories, search]);

  const pinnedCount = memories.filter((m) => m.pinned).length;

  function onAdd() {
    const t = newText.trim();
    if (!t) return;
    addMemory({ text: t, category: newCategory, pinned: newPinned });
    setNewText("");
    setNewCategory("");
    inputRef.current?.focus();
    toast.success("Memory added");
  }

  function startEdit(m: MemoryRecord) {
    setEditingId(m.id);
    setEditText(m.text);
    setEditCategory(m.category);
  }

  function saveEdit(id: string) {
    const t = editText.trim();
    if (!t) return;
    updateMemory(id, { text: t, category: editCategory.trim() });
    setEditingId(null);
    toast.success("Memory updated");
  }

  function onDelete(id: string) {
    if (!confirm("Delete this memory?")) return;
    deleteMemory(id);
  }

  function onExport() {
    const bundle = {
      app: "mgi",
      kind: "memories",
      version: 1,
      exportedAt: new Date().toISOString(),
      memories,
    };
    downloadFile(
      `mgi-memories-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json",
    );
    toast.success(`Exported ${memories.length} memor${memories.length === 1 ? "y" : "ies"}.`);
  }

  async function onImport(mode: "merge" | "replace") {
    try {
      if (mode === "replace" && !confirm("Replace ALL memories with the imported file?")) return;
      const text = await pickJSONFile();
      if (!text) return;
      const res = importMemories(text, mode);
      toast.success(`Imported ${res.imported}. Total ${res.total}.`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  }

  function onClearAll() {
    if (!confirm("Delete ALL memories? This cannot be undone.")) return;
    clearAll();
    toast.success("All memories cleared.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Memory"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
        <header className="relative shrink-0 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
            <MgiLogo size={26} className="shrink-0" />
            <h1 className="truncate text-base font-semibold">Memory</h1>
            <span className="hidden md:inline text-xs text-muted-foreground">
              {memories.length} total · {pinnedCount} pinned (injected into every chat)
            </span>
            <div className="flex-1" />
            <button
              onClick={close}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close memory"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="mgi-scroll flex-1 overflow-y-auto px-3 py-4">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Add a memory</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Only <b>pinned</b> memories are injected into the chat as local
                notes. They are hints, not instructions.
              </p>
              <textarea
                ref={inputRef}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                rows={3}
                placeholder="e.g. I prefer concise answers with bullet points."
                className="mgi-scroll mt-3 w-full resize-none rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="w-56 rounded-lg border border-border bg-input/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={newPinned}
                    onChange={(e) => setNewPinned(e.target.checked)}
                  />
                  Pin (inject into chats)
                </label>
                <div className="flex-1" />
                <button
                  onClick={onAdd}
                  disabled={!newText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search memories"
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {memories.length === 0
                    ? "No memories yet. Add one above."
                    : "No memories match your search."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((m) => {
                    const editing = editingId === m.id;
                    return (
                      <li
                        key={m.id}
                        className={cn(
                          "rounded-lg border border-border bg-card p-3",
                          m.pinned && "ring-1 ring-primary/40",
                        )}
                      >
                        {editing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              spellCheck
                              autoCorrect="on"
                              autoCapitalize="sentences"
                              rows={3}
                              className="mgi-scroll w-full resize-none rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                placeholder="Category"
                                className="w-56 rounded-lg border border-border bg-input/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                              />
                              <div className="flex-1" />
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(m.id)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                              >
                                <Check className="h-3.5 w-3.5" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                {m.category && (
                                  <span className="rounded-full border border-border px-1.5 py-0.5">
                                    {m.category}
                                  </span>
                                )}
                                {m.pinned && (
                                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                                    Pinned
                                  </span>
                                )}
                                <span>
                                  {new Date(m.updatedAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                {m.text}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => togglePin(m.id)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={m.pinned ? "Unpin" : "Pin"}
                                title={m.pinned ? "Unpin" : "Pin (inject into chats)"}
                              >
                                {m.pinned ? (
                                  <PinOff className="h-4 w-4" />
                                ) : (
                                  <Pin className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => startEdit(m)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDelete(m.id)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Backup</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button
                  onClick={() => onImport("merge")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <Upload className="h-3.5 w-3.5" /> Import (merge)
                </button>
                <button
                  onClick={() => onImport("replace")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <Upload className="h-3.5 w-3.5" /> Import (replace)
                </button>
                <div className="flex-1" />
                <button
                  onClick={onClearAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
