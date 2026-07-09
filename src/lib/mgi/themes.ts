import type { AccentName, ThemeMode } from "./types";

export interface AccentDef {
  name: AccentName;
  label: string;
  // oklch triples for light and dark accents
  light: string;
  dark: string;
  onAccent: string; // foreground on filled accent surface
  /**
   * If set, selecting this accent forces the theme mode.
   * Used for premium metallic themes that only look right in one mode.
   */
  forceMode?: ThemeMode;
  /**
   * Metallic accents render with a multi-stop gradient sheen on primary
   * surfaces (buttons, logo tile, swatch). The base `--accent-oklch` is
   * still the average tone so components without metallic support degrade
   * gracefully.
   */
  metallic?: {
    /** CSS gradient used as the primary button / surface background. */
    surface: string;
    /** CSS gradient used for the round swatch preview. */
    swatch: string;
    /** Optional soft glow color for focus rings. */
    ring?: string;
  };
}

// Metallic gradient recipes reused between swatch + surface.
const GOLD_SURFACE =
  "linear-gradient(135deg, #d4a24a 0%, #f6dc85 22%, #b8862b 48%, #f7e39a 72%, #a06b18 100%)";
const GOLD_SWATCH =
  "conic-gradient(from 210deg at 50% 50%, #b8862b, #f7e39a, #d4a24a, #8a5a10, #f6dc85, #b8862b)";

const PLAT_SURFACE =
  "linear-gradient(135deg, #b8bcc4 0%, #eef1f5 22%, #7d838d 48%, #dfe3ea 72%, #6a707a 100%)";
const PLAT_SWATCH =
  "conic-gradient(from 210deg at 50% 50%, #7d838d, #eef1f5, #b8bcc4, #5a6068, #dfe3ea, #7d838d)";

export const ACCENTS: AccentDef[] = [
  { name: "yellow", label: "Yellow", light: "0.82 0.17 92", dark: "0.86 0.17 92", onAccent: "0.2 0.02 90" },
  { name: "hotOrange", label: "Hot Orange", light: "0.68 0.21 40", dark: "0.72 0.21 40", onAccent: "1 0 0" },
  { name: "cobalt", label: "Cobalt", light: "0.55 0.22 260", dark: "0.66 0.22 260", onAccent: "1 0 0" },
  { name: "purple", label: "Purple", light: "0.55 0.24 300", dark: "0.68 0.24 300", onAccent: "1 0 0" },
  { name: "red", label: "Red", light: "0.58 0.24 25", dark: "0.68 0.24 25", onAccent: "1 0 0" },
  { name: "emerald", label: "Emerald", light: "0.62 0.16 155", dark: "0.72 0.16 155", onAccent: "1 0 0" },
  { name: "lime", label: "Lime", light: "0.82 0.2 130", dark: "0.86 0.2 130", onAccent: "0.15 0.02 130" },
  { name: "mango", label: "Mango", light: "0.78 0.18 55", dark: "0.82 0.18 55", onAccent: "0.18 0.03 55" },
  { name: "periwinkle", label: "Periwinkle", light: "0.72 0.12 255", dark: "0.78 0.12 255", onAccent: "0.18 0.03 255" },
  { name: "mono", label: "Mono", light: "0.18 0 0", dark: "0.96 0 0", onAccent: "1 0 0" },
  {
    name: "gold",
    label: "Gold",
    // Warm metallic gold — light mode only.
    light: "0.78 0.13 82",
    dark: "0.78 0.13 82",
    onAccent: "0.18 0.03 80",
    forceMode: "light",
    metallic: { surface: GOLD_SURFACE, swatch: GOLD_SWATCH, ring: "#c8952f" },
  },
  {
    name: "platinum",
    label: "Platinum",
    // Cool metallic silver — dark mode only.
    light: "0.82 0.01 260",
    dark: "0.82 0.01 260",
    onAccent: "0.15 0.01 260",
    forceMode: "dark",
    metallic: { surface: PLAT_SURFACE, swatch: PLAT_SWATCH, ring: "#c5cad2" },
  },
];

export function accentByName(name: AccentName): AccentDef {
  return ACCENTS.find((a) => a.name === name) ?? ACCENTS[2];
}
