// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { generateSW } from "workbox-build";
import type { Plugin } from "vite";

export default defineConfig({
  // Static build: no runtime Nitro/Node server. TanStack Start's SPA
  // prerender emits `dist/client/index.html`, and the client bundle is
  // fully self-contained. Capacitor's Android WebView loads that folder.
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
    // SPA mode: prerender a single shell HTML at `dist/client/index.html`
    // and let the client router take over for all other paths at runtime.
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: { outputPath: "/index.html", crawlLinks: false },
    },
  },
  vite: {
    plugins: [
      // Guarded PWA offline shell. Registration is refused in dev / Lovable preview
      // by src/lib/mgi/pwa-register.ts — this plugin only builds the SW; a runtime
      // wrapper decides whether to register it.
      //
      // Scope every emitted plugin to the `client` environment. Vite 8's
      // environment API otherwise resolves the plugin against both `client`
      // and `ssr` envs; the SSR resolution wins last and vite-plugin-pwa's
      // `closeBundle` short-circuits when `build.ssr` is truthy, so no
      // `sw.js` ever gets written next to `index.html`.
      ...VitePWA({
        registerType: "prompt", // safer than autoUpdate: never auto-reload during a live chat stream
        injectRegister: null,   // registration handled by our guarded wrapper only
        devOptions: { enabled: false },
        filename: "sw.js",
        // We ship our own public/manifest.webmanifest — don't let the plugin overwrite it.
        manifest: false,
        workbox: {
          // Precache ONLY the built app shell + local static assets. No API data.
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          // Never intercept OpenRouter or any streaming/chat traffic.
          // Cross-origin requests (openrouter.ai) are not matched by these handlers.
          runtimeCaching: [
            {
              // Same-origin HTML navigations: network-first so updates roll out.
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "mgi-html",
                networkTimeoutSeconds: 4,
              },
            },
            {
              // Same-origin hashed static assets.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin &&
                /\.(?:js|css|woff2|png|svg|ico|webmanifest)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "mgi-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
          // Belt & braces: never cache anything with an Authorization header
          // or POST bodies. Workbox already ignores non-GET; this documents intent.
          cleanupOutdatedCaches: true,
          clientsClaim: false, // wait for user confirmation via the "Update available" prompt
          skipWaiting: false,
        },
      }).map((p) => ({
        ...p,
        applyToEnvironment: (env: { name: string }) => env.name === "client",
      })),
      // Belt-and-braces: also emit `dist/client/sw.js` ourselves. Vite 8's
      // multi-environment build resolves vite-plugin-pwa's `configResolved`
      // against the ssr environment last, which flips `build.ssr` to true
      // and makes its own `closeBundle` skip generating the service worker.
      // Running workbox-build directly after the client bundle closes
      // guarantees `sw.js` lands next to `index.html` for the PWA and for
      // the Capacitor Android wrapper.
      swPostBuildPlugin(),
    ],
  },
});

function swPostBuildPlugin(): Plugin {
  return {
    name: "mgi-sw-post-build",
    apply: "build",
    applyToEnvironment: (env: { name: string }) => env.name === "client",
    async closeBundle() {
      const outDir = "dist/client";
      try {
        await generateSW({
          swDest: `${outDir}/sw.js`,
          globDirectory: outDir,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
                sameOrigin && request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "mgi-html",
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
                sameOrigin &&
                /\.(?:js|css|woff2|png|svg|ico|webmanifest)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "mgi-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        });
      } catch (err) {
        // Non-fatal: the app still runs without the offline shell.
        console.warn("[mgi] workbox generateSW failed:", err);
      }
    },
  };
}
