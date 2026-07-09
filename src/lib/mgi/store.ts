import { useCallback, useEffect, useState } from "react";
import type { AppSettings, Conversation } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SETTINGS_KEY = "mgi:settings:v1";
const CONVERSATIONS_KEY = "mgi:conversations:v1";
const ACTIVE_KEY = "mgi:active-conversation:v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const stored = safeParse<Partial<AppSettings>>(
    localStorage.getItem(SETTINGS_KEY),
    {},
  );
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    params: { ...DEFAULT_SETTINGS.params, ...(stored.params ?? {}) },
  };
}

function readConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  return safeParse<Conversation[]>(localStorage.getItem(CONVERSATIONS_KEY), []);
}

// --- Settings hook ---
type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    setSettings(readSettings());
    const l = () => setSettings(readSettings());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...readSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    emit();
  }, []);

  const updateParams = useCallback((patch: Partial<AppSettings["params"]>) => {
    const cur = readSettings();
    const next = { ...cur, params: { ...cur.params, ...patch } };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    emit();
  }, []);

  return { settings, update, updateParams };
}

// --- Conversations hook ---
const convListeners = new Set<Listener>();
function emitConv() {
  convListeners.forEach((l) => l());
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    setConversations(readConversations());
    setActiveIdState(localStorage.getItem(ACTIVE_KEY));
    const l = () => {
      setConversations(readConversations());
      setActiveIdState(localStorage.getItem(ACTIVE_KEY));
    };
    convListeners.add(l);
    return () => {
      convListeners.delete(l);
    };
  }, []);

  const persist = (list: Conversation[]) => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
    emitConv();
  };

  const setActiveId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
    emitConv();
  }, []);

  const createConversation = useCallback((): Conversation => {
    const c: Conversation = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const list = [c, ...readConversations()];
    persist(list);
    setActiveId(c.id);
    return c;
  }, [setActiveId]);

  const updateConversation = useCallback(
    (id: string, patch: Partial<Conversation> | ((c: Conversation) => Conversation)) => {
      const list = readConversations();
      const next = list.map((c) => {
        if (c.id !== id) return c;
        const updated =
          typeof patch === "function"
            ? patch(c)
            : { ...c, ...patch };
        return { ...updated, updatedAt: Date.now() };
      });
      persist(next);
    },
    [],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      const list = readConversations().filter((c) => c.id !== id);
      persist(list);
      const active = localStorage.getItem(ACTIVE_KEY);
      if (active === id) setActiveId(list[0]?.id ?? null);
    },
    [setActiveId],
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      updateConversation(id, { title });
    },
    [updateConversation],
  );

  return {
    conversations,
    activeId,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
    renameConversation,
  };
}
