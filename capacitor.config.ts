/**
 * Capacitor config for wrapping MGI as an Android app.
 *
 * This file is inert until you actually install Capacitor:
 *
 *   npm install @capacitor/core @capacitor/cli @capacitor/android
 *   npx cap add android
 *   npx cap sync android
 *
 * BUILD OUTPUT:
 *   `npm run build` now produces a FULLY STATIC client-side app under
 *   `dist/client/`, with a real `index.html`, hashed JS/CSS in `assets/`,
 *   `manifest.webmanifest`, `icon.png`, and a precached PWA service worker
 *   (`sw.js` + `workbox-*.js`). Nitro/SSR is disabled — nothing runs on a
 *   server at runtime. That folder is exactly what Capacitor bundles into
 *   the Android WebView, so `webDir` points straight at it.
 *
 *   TanStack Start still emits a `dist/server/` folder as a build-time
 *   byproduct (used only to prerender the shell HTML). It is not shipped
 *   to the phone.
 *
 * See README → "Android Play Store Build Path" for full instructions.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.monty.glminterface",
  appName: "Monty's GLM Interface",
  // Static, self-contained web bundle produced by `npm run build`.
  webDir: "dist/client",
  // Version name / code are set in android/app/build.gradle after `npx cap add android`.
  // Keep them in sync with these values on every release:
  //   versionName "1.0.0"
  //   versionCode 1
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
    // Leave `url` unset for a fully-offline bundled app — the WebView loads
    // `dist/client/index.html` directly. Only set `url` if you'd rather
    // point the WebView at a hosted deployment.
    // url: "https://mgi.example.com",
    // cleartext: false,
  },
};

export default config;
