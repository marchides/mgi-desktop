import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { MgiLogo } from "@/components/mgi/MgiLogo";
import { useConversations, useSettings } from "@/lib/mgi/store";
import { verifyApiKey } from "@/lib/mgi/openrouter";
import { ACCENTS } from "@/lib/mgi/themes";
import {
  clearAllLocalData,
  exportAllConversationsJSON,
  exportConversationMarkdown,
  importConversationsJSON,
  pickJSONFile,
} from "@/lib/mgi/backup";
import type {
  AccentName,
  HistoryMode,
  ReasoningEffort,
  RoutingMode,
  ThemeMode,
} from "@/lib/mgi/types";
import { MAX_OUTPUT_PRESETS, MODEL_PRESETS } from "@/lib/mgi/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — MGI" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { settings, update, updateParams } = useSettings();
  const { conversations, activeId } = useConversations();
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const activeConversation = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const closeSettings = () => navigate({ to: "/" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function onExportAll() {
    try {
      const n = exportAllConversationsJSON();
      toast.success(`Exported ${n} chat${n === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    }
  }

  async function onImport(mode: "merge" | "replace") {
    try {
      if (mode === "replace" && !confirm(
        "Replace ALL local chats with the imported file? This cannot be undone.",
      )) return;
      const text = await pickJSONFile();
      if (!text) return;
      const res = importConversationsJSON(text, mode);
      toast.success(`Imported ${res.imported} chat${res.imported === 1 ? "" : "s"} (${res.total} total).`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  }

  function onExportCurrentMd() {
    if (!activeConversation || activeConversation.messages.length === 0) {
      toast.error("No active chat to export.");
      return;
    }
    exportConversationMarkdown(activeConversation);
    toast.success("Chat exported as Markdown.");
  }

  function onClearAll() {
    if (!confirm(
      "This will permanently delete ALL local MGI data on this device:\n\n• Every chat and message\n• Your API key\n• Theme, model, and all settings\n\nExport your chats first if you want to keep them. This cannot be undone. Continue?",
    )) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    clearAllLocalData();
    toast.success("All local MGI data cleared.");
    setTimeout(() => window.location.reload(), 600);
  }

  async function onVerify() {
    setVerifying(true);
    const res = await verifyApiKey(settings.apiKey);
    setVerifying(false);
    update({ keyStatus: res.ok ? "valid" : "invalid" });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  }


  return (
    <div
      className="fixed inset-0 z-50 flex bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
        <header className="relative shrink-0 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
            <MgiLogo size={26} className="shrink-0" />
            <h1 className="truncate text-base font-semibold">Settings</h1>
            <span className="hidden md:inline text-xs text-muted-foreground">Monty's GLM Interface</span>
            <div className="flex-1" />
            <button
              onClick={closeSettings}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close settings"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

      <div className="mgi-scroll flex-1 overflow-y-auto px-3 py-3 sm:py-4">
        <div className="mx-auto w-full max-w-3xl xl:max-w-4xl space-y-3 sm:space-y-4">
...
        <div className="py-6 text-center text-[11px] text-muted-foreground">
          Monty's GLM Interface (Desktop Edition) · MGI v1.0
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}


// ---- Reusable UI bits ----

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <h2 className="font-display text-sm font-semibold">{title}</h2>
      {description && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      )}
      <div className="mt-2 space-y-2 sm:mt-3">{children}</div>
    </section>

  );
}

function PillButton({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs font-medium transition",
        selected
          ? "border-transparent bg-primary text-primary-foreground shadow"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function StatusPill({
  status,
  hasKey,
}: {
  status: "unknown" | "valid" | "invalid";
  hasKey: boolean;
}) {
  if (!hasKey)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Missing key
      </span>
    );
  const cfg = {
    unknown: { color: "bg-muted-foreground", label: "Unverified" },
    valid: { color: "bg-emerald-500", label: "Valid" },
    invalid: { color: "bg-destructive", label: "Invalid" },
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.color)} />
      {cfg.label}
    </span>
  );
}

function AccentSwatch({
  name,
  oklchLight,
  oklchDark,
  label,
  selected,
  onClick,
}: {
  name: AccentName;
  oklchLight: string;
  oklchDark: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = ACCENTS.find((a) => a.name === name);
  const isMetallic = !!meta?.metallic;
  const background = isMetallic
    ? meta!.metallic!.swatch
    : `linear-gradient(135deg, oklch(${oklchLight}), oklch(${oklchDark}))`;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition",
        selected ? "border-primary bg-accent" : "border-border hover:bg-muted",
      )}
      aria-label={label}
      title={
        meta?.forceMode
          ? `${label} — ${meta.forceMode} mode only`
          : label
      }
    >
      <span
        className={cn(
          "h-8 w-8 rounded-full shadow-inner",
          isMetallic && "ring-1 ring-black/10 dark:ring-white/15",
        )}
        style={{ background }}
      />
      <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
      {selected && <span className="sr-only">Selected {name}</span>}
    </button>
  );
}


function formatTokens(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
