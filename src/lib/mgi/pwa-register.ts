/// <reference types="vite-plugin-pwa/client" />
import { toast } from "sonner";

/**
 * Guarded service-worker registration for MGI.
 *
 * Refuses to register in:
 *   - dev builds
 *   - Lovable preview / iframe hosts
 *   - `?sw=off` kill-switch
 *
 * When a new SW version is waiting, shows a small "Update available" toast
 * instead of auto-reloading — so a mid-stream chat is never interrupted.
 */
export async function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const killSwitch = url.searchParams.get("sw") === "off";
  const refuse = !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch;

  if (refuse) {
    // Clean up any stale registration in refused contexts.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        const script = r.active?.scriptURL ?? "";
        if (script.endsWith("/sw.js")) await r.unregister();
      }
    } catch {
      /* noop */
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast("Update available", {
          description: "A newer version of MGI is ready.",
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => {
              // Reloads after the new SW activates. Only fires on explicit user tap,
              // so an in-progress chat stream is never killed by auto-update.
              void updateSW(true);
            },
          },
        });
      },
      onOfflineReady() {
        toast.success("Ready to use offline", {
          description: "App shell cached. Chat still needs internet.",
        });
      },
    });
  } catch (err) {
    console.warn("[MGI] Service worker registration failed", err);
  }
}
