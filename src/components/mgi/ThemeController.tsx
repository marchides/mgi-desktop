import { useEffect } from "react";
import { useSettings } from "@/lib/mgi/store";
import { accentByName } from "@/lib/mgi/themes";

/**
 * Applies theme mode (light/dark/system) and accent color as CSS vars.
 * Mounted once at the app root.
 */
export function ThemeController() {
  const { settings, update } = useSettings();

  // If a mode-locked accent is selected in the wrong mode, force the mode.
  useEffect(() => {
    const accent = accentByName(settings.accent);
    if (accent.forceMode && settings.themeMode !== accent.forceMode) {
      update({ themeMode: accent.forceMode });
    }
  }, [settings.accent, settings.themeMode, update]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const accent = accentByName(settings.accent);
      const effectiveMode = accent.forceMode ?? settings.themeMode;
      const dark =
        effectiveMode === "dark" ||
        (effectiveMode === "system" && prefersDark);
      root.classList.toggle("dark", dark);
      const val = dark ? accent.dark : accent.light;
      root.style.setProperty("--accent-oklch", val);
      const onAccent =
        accent.name === "mono"
          ? dark
            ? "0.12 0 0"
            : "1 0 0"
          : accent.onAccent;
      root.style.setProperty("--on-accent-oklch", onAccent);
      const hue = val.split(" ")[2] ?? "260";
      root.style.setProperty("--accent-hue", hue);

      // Metallic sheen: expose gradients as CSS vars and toggle a body class
      // so CSS can paint primary buttons / logo with the metallic surface.
      if (accent.metallic) {
        root.style.setProperty("--accent-metallic-surface", accent.metallic.surface);
        root.style.setProperty("--accent-metallic-swatch", accent.metallic.swatch);
        root.classList.add("mgi-metallic");
        root.dataset.metallic = accent.name;
      } else {
        root.style.removeProperty("--accent-metallic-surface");
        root.style.removeProperty("--accent-metallic-swatch");
        root.classList.remove("mgi-metallic");
        delete root.dataset.metallic;
      }
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.themeMode, settings.accent]);

  return null;
}

