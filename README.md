# Monty's GLM Interface (MGI)

A polished mobile-first **PWA** chat client for **GLM models via OpenRouter**, built on TanStack Start + React. Not Expo, not React Native — a real web app engineered to install cleanly on Android and later wrap into a Play Store `.aab` via Capacitor.

## Features

- Chat with `z-ai/glm-5.2` (default), `glm-5.2:floor`, `glm-5.1`, `glm-4.6`, or any custom OpenRouter model ID.
- Routing modes: **Balanced**, **Cheapest** (`sort: price`, price caps), **Fastest** (`sort: throughput`).
- Full model parameter control: temperature, top_p, top_k, frequency/presence/repetition penalty, reasoning effort, include-reasoning toggle.
- Dynamic max-output-token calculation up to the 1,048,576-token context window.
- Conversation history: rename, delete, search, clear, copy, regenerate, edit-and-resubmit, stop generation.
- Streaming responses, markdown + code blocks with copy button.
- History modes: full / recent N / auto-trim.
- Optional system prompt.
- Light & dark themes + 7 standard accents plus two premium metallic accents: **Gold** (light-only) and **Platinum** (dark-only). Mode-locked accents auto-switch the theme mode when selected.
- Mobile safe-area + keyboard-safe bottom input.
- API key stored **locally on device only** (`localStorage`). Never logged, never sent anywhere except `openrouter.ai`.
- Installable PWA with proper manifest, standalone display, portrait orientation, Z.ai-based icon.

## Run locally

```bash
npm install
npm run dev
```

Open in a mobile browser or use device emulation.

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

Deploy `dist/client/` to any static host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, S3, nginx). Serve over HTTPS so the PWA install prompt (and Capacitor wrapping) work.



## Add your OpenRouter API key

1. Get a key at https://openrouter.ai/keys
2. Open **Settings** in MGI
3. Paste the key, tap **Verify**, then **Save**

All OpenRouter calls are centralized in `src/lib/mgi/openrouter.ts`. No backend, no server-side dependency, no hardcoded keys, no external secrets.

## Offline behavior (PWA)

MGI ships a guarded service worker via `vite-plugin-pwa`. It caches **only the app shell** (HTML, JS, CSS, icons, manifest) so you can still open the app offline and view:

- saved conversations
- settings, themes, model parameters
- local history

The service worker **never** caches:

- OpenRouter API requests or responses
- streaming chat completions
- `Authorization` headers or API keys
- any cross-origin request

OpenRouter calls are always network-only (`cache: "no-store"`). If you're offline, `streamChatCompletion` short-circuits with **“You are offline. Chat requires internet.”** and a persistent banner appears at the top of the app.

**Update behavior**: `registerType: "prompt"` — when a new build is deployed, a small **“Update available → Reload”** toast appears. Nothing auto-reloads, so a mid-generation chat is never killed. Add `?sw=off` to any URL to force-unregister the SW during debugging.

**Preview safety**: the registration wrapper in `src/lib/mgi/pwa-register.ts` refuses to register in dev, inside iframes, on Lovable preview hosts, and when `?sw=off` is set. If `vite-plugin-pwa` ever causes trouble in this TanStack Start setup, delete the `VitePWA(...)` block from `vite.config.ts` and stop importing `registerServiceWorker` from `__root.tsx` — the app keeps working as a plain installable manifest-only PWA.

## Replacing localStorage with Capacitor secure storage

Every persistent value in MGI lives under one of three keys in `localStorage`:

- `mgi:settings:v1` — includes the **OpenRouter API key**
- `mgi:conversations:v1` — chat history
- `mgi:active-conversation:v1` — currently open thread

All reads/writes go through `src/lib/mgi/store.ts` (and the tiny adapter in `src/lib/mgi/secure-storage.ts`). To move to native storage after wrapping with Capacitor:

1. `npm install @capacitor/preferences` (general values) and `@capacitor-community/secure-storage-plugin` (API key → Android Keystore).
2. Replace the `window.localStorage.getItem/setItem/removeItem` calls in `src/lib/mgi/secure-storage.ts` with the async Capacitor equivalents (sketch in that file).
3. Convert the two consumers in `src/lib/mgi/store.ts` to `async` — no component touches storage directly, so nothing else changes.
4. For the API key alone, route through the secure-storage plugin so it lands in the Android Keystore rather than plain SharedPreferences.

## Architecture notes for future Capacitor wrapping

- Every network call to OpenRouter goes through one file: `src/lib/mgi/openrouter.ts`.
- The API key is read/written in exactly one place: `src/lib/mgi/store.ts` (`useSettings`). See "Replacing localStorage" above.
- Layout uses `env(safe-area-inset-bottom)` and sticky positioning — no assumptions about a desktop viewport.
- No cookies, no server sessions, no environment variables required at runtime.

## Android Play Store Build Path

Target config (change to match your Play Console listing):

| Field | Value |
| --- | --- |
| App name | `Monty's GLM Interface` |
| Android package ID | `com.monty.glminterface` |
| Version name | `1.0.0` |
| Version code | `1` |

A ready-to-use `capacitor.config.ts` is included at the project root with these placeholders.

### Which webDir?

`webDir` is set to `dist/client` in `capacitor.config.ts`. That folder is produced by `npm run build` and contains a real static `index.html` (prerendered SPA shell), hashed assets, PWA manifest, icon, and precached service worker — everything the Android WebView needs to run MGI fully offline. No `server.url` is required.

Steps:

```bash
# 1. Install deps and build the static web bundle
npm install
npm run build
# → produces dist/client/ (index.html, assets/, manifest.webmanifest, icon.png, sw.js)

# 2. Add Capacitor + Android platform
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android

# 3. Sync the built web assets into the Android project
npx cap sync android

# 4. Open Android Studio
npx cap open android
```


In Android Studio:

1. Wait for Gradle sync to finish.
2. Set the **Application ID** to `com.monty.glminterface` (already wired via `capacitor.config.ts`) and confirm `versionName` / `versionCode` in `android/app/build.gradle`.
3. **Build → Generate Signed Bundle / APK → Android App Bundle**.
4. Create or select a keystore, fill in the passwords, and pick the `release` variant.
5. Android Studio produces `android/app/release/app-release.aab`.

Upload the `.aab`:

1. Sign in to **Google Play Console** → your app → **Production** (or Internal testing).
2. **Create new release** → upload `app-release.aab`.
3. Fill in release notes, save, review, and roll out.

Each subsequent release: bump `versionCode` (integer, must strictly increase) and `versionName` in both `capacitor.config.ts` and `android/app/build.gradle`, then re-run `npm run build && npx cap sync android` before rebuilding the bundle.

### Play Store submission checklist

Before pressing **Roll out** in Play Console:

- [ ] Signed `.aab` built from the `release` variant with your keystore
- [ ] `applicationId` = `com.monty.glminterface` (matches Play Console listing)
- [ ] `versionCode` strictly greater than the previously uploaded build
- [ ] `versionName` follows semver (e.g. `1.0.0`, `1.0.1`)
- [ ] App icon (512×512 PNG) uploaded to Play Console
- [ ] Feature graphic (1024×500 PNG) uploaded
- [ ] At least 2 phone screenshots
- [ ] Short description (≤80 chars) and full description (≤4000 chars) written
- [ ] Privacy policy URL — required because the app collects and stores an API key locally; publish a page stating: no data leaves the device except direct calls to `openrouter.ai`
- [ ] Data safety form filled: "no data collected by the developer"
- [ ] Content rating questionnaire completed
- [ ] Target audience & content declaration (13+ is typical)
- [ ] App category set (Productivity / Tools)
- [ ] Internal testing track validated on a real device before Production
- [ ] Ads declaration: **No ads**
- [ ] Government / financial declarations: **No**


## Alternative: Trusted Web Activity (Bubblewrap)

If you'd rather ship the hosted PWA as a Play Store app without Capacitor:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest
bubblewrap build
```

Upload the resulting `.aab` to Play Console.

## Security

- The OpenRouter API key lives only in `localStorage` under `mgi:settings:v1`.
- The key is sent only as `Authorization: Bearer …` to `openrouter.ai`.
- No analytics, no backend, no telemetry.
- No `.env` files are required or committed.
