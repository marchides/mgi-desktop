/**
 * Local key/value storage adapter for MGI.
 *
 * Today: thin sync wrapper over `localStorage`. All settings, conversations,
 * and the OpenRouter API key live here.
 *
 * When wrapping this app with Capacitor for Android, swap the two `localStorage`
 * calls below for @capacitor/preferences (or a secure-storage plugin) — the rest
 * of the app stays untouched because every consumer already goes through this
 * module OR through src/lib/mgi/store.ts which uses the same pattern.
 *
 * Capacitor replacement sketch (async — you'll need to adapt call sites):
 *
 *   import { Preferences } from "@capacitor/preferences";
 *   export const kv = {
 *     async getItem(k: string) { return (await Preferences.get({ key: k })).value; },
 *     async setItem(k: string, v: string) { await Preferences.set({ key: k, value: v }); },
 *     async removeItem(k: string) { await Preferences.remove({ key: k }); },
 *   };
 *
 * For the API key specifically, prefer a secure-storage plugin such as
 * `@capacitor-community/secure-storage-plugin` so the token is stored in the
 * Android Keystore rather than plain SharedPreferences.
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
