# MGI Desktop (Tauri)

Rust/Tauri wrapper for **Monty's GLM Interface (Desktop Edition)**.

The web app is built by Vite into `../dist/client/` and loaded by Tauri as a
static bundle. Everything else — chat, OpenRouter streaming, API key storage,
themes, attachments — runs in the same client-side code as the web build.

See the root `README.md` → **Desktop Build Path** for build & packaging steps.

Place platform icons in `icons/` (PNG 32/128/128@2x, `.icns`, `.ico`) before
running `tauri build`. `tauri icon path/to/source.png` will generate them for you.
