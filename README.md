# Monty's GLM Interface (Desktop Edition) — MGI

A **desktop-first** chat client for **GLM models via OpenRouter**, built on TanStack Start + React. Wide screens, permanent conversation sidebar, compact top bar, resizable settings panels, keyboard shortcuts. A responsive mobile fallback is preserved.

> This project lives in **its own GitHub repository**, separate from any earlier mobile/Android MGI project. This edition targets **desktop (Tauri) and the web** only — there is **no Android/Play Store build path** here.

## Features

- Chat with `z-ai/glm-5.2` (default), `glm-5.2:floor`, `glm-5.1`, `glm-4.6`, or any custom OpenRouter model ID.
- Routing modes: **Balanced**, **Cheapest** (`sort: price`, price caps), **Fastest** (`sort: throughput`).
- Full model parameter control: temperature, top_p, top_k, frequency/presence/repetition penalty, reasoning effort, include-reasoning toggle.
- Dynamic max-output-token calculation up to the 1,048,576-token context window.
- Conversation history: rename, delete, search, clear, copy, regenerate, edit-and-resubmit, stop generation.
- Streaming responses, markdown + code blocks with copy button.
- History modes: full / recent N / auto-trim.
- Optional system prompt.
- Light & dark themes + 9 standard accents plus two premium metallic accents: **Gold** (light-only) and **Platinum** (dark-only). Mode-locked accents auto-switch the theme mode when selected.
- Accent-driven stage lighting: radial glow, subtle grid backdrop, and wordmark accent all follow the selected theme colour.
- API key stored **locally on device only** (`localStorage`). Never logged, never sent anywhere except `openrouter.ai`.
- Installable PWA with proper manifest, standalone display, Z.ai-based icon.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

MGI builds to a **fully static** client-side app — no Node/SSR server at runtime:

| Path | Contents |
| --- | --- |
| `dist/client/index.html` | Prerendered SPA shell (TanStack Start SPA mode) |
| `dist/client/assets/` | Hashed JS/CSS bundles |
| `dist/client/manifest.webmanifest`, `dist/client/icon.png` | PWA manifest + icon |
| `dist/client/sw.js`, `dist/client/workbox-*.js` | Precached service worker for the offline shell |
| `dist/server/` | Build-time byproduct used only to prerender the shell. **Not deployed.** |

Deploy `dist/client/` to any static host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, S3, nginx). Serve over HTTPS so the PWA install prompt (and Tauri packaging) work.

## Add your OpenRouter API key

1. Get a key at https://openrouter.ai/keys
2. Open **Settings** in MGI
3. Paste the key, tap **Verify**, then **Save**

All OpenRouter calls are centralized in `src/lib/mgi/openrouter.ts`. No backend, no server-side dependency, no hardcoded keys, no external secrets.

## Offline behavior (PWA)

MGI ships a guarded service worker via `vite-plugin-pwa`. It caches **only the app shell** (HTML, JS, CSS, icons, manifest) so you can still open the app offline and view saved conversations, settings, themes, model parameters, and local history.

The service worker **never** caches OpenRouter API requests/responses, streaming chat completions, `Authorization` headers or API keys, or any cross-origin request. OpenRouter calls are always network-only (`cache: "no-store"`).

**Update behavior**: `registerType: "prompt"` — when a new build is deployed, a small **"Update available → Reload"** toast appears. Nothing auto-reloads.

## Security

- The OpenRouter API key lives only in `localStorage` under `mgi:settings:v1`.
- The key is sent only as `Authorization: Bearer …` to `openrouter.ai`.
- No analytics, no backend, no telemetry.
- No `.env` files are required or committed.

## Desktop Build Path

MGI Desktop Edition is packaged as a native app using **Tauri 2**. The web bundle (`dist/client/`) is embedded and rendered by the OS webview — no browser required.

### Keep the desktop repo separate

This desktop edition lives in **its own GitHub repository**. Do **not** commit these Tauri changes back to any earlier mobile MGI repo. Connect this project to a fresh repo (e.g. `mgi-desktop`) via `Plus (+) → GitHub → Connect project` inside Lovable.

### Prerequisites (local machine)

- Node.js 20+ and npm/bun
- Rust (stable) via https://rustup.rs
- Platform toolchain:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools + WebView2 (preinstalled on Win 11)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### One-time setup

```bash
npm install
npm i -D @tauri-apps/cli
npx tauri icon public/icon.png     # generates src-tauri/icons/*
```

### Dev

```bash
npx tauri dev
```

Runs `npm run dev` (Vite on `http://localhost:8080`) and opens a native window pointing at the dev server with hot reload.

### Production build

```bash
npx tauri build
```

Outputs installers to `src-tauri/target/release/bundle/`:

| Platform | Artifact |
| --- | --- |
| macOS | `.app`, `.dmg` |
| Windows | `.msi`, `.exe` (NSIS) |
| Linux | `.AppImage`, `.deb`, `.rpm` |

### Configuration

- `src-tauri/tauri.conf.json` — window size, identifier, bundle targets.
- `src-tauri/Cargo.toml` — Rust dependencies.
- `src-tauri/src/main.rs` — native entry point.
- Frontend build output must remain at `dist/client/` (already wired via `frontendDist`).

### Notes

- All chat logic, OpenRouter streaming, API-key storage, models, themes, and attachments are unchanged from the web build — Tauri only provides the shell.
- The OpenRouter API key still lives in the webview's `localStorage`, scoped to the app identifier `app.mgi.desktop`.
- The PWA service worker is not used in the Tauri build (assets are already local).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + N` | New chat |
| `Ctrl/Cmd + K` | Focus conversation search |
| `Ctrl/Cmd + B` | Toggle conversation sidebar |
| `Ctrl/Cmd + /` | Focus composer |
| `Enter` | Send message |
| `Shift + Enter` | Newline in composer |
| `Esc` | Stop streaming response |
