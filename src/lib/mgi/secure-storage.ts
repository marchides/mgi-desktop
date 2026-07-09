/**
 * Local key/value storage adapter for MGI.
 *
 * Thin sync wrapper over `localStorage`. All settings, conversations, and the
 * OpenRouter API key live here. In the Tauri desktop build the same
 * `localStorage` is provided by the OS webview and scoped to the app
 * identifier, so no adapter change is required.
 */

export const kv = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};
