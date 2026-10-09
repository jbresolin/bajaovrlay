# @bajaovrlay/renderer

The page OBS loads as a browser source. It draws graphics onto a transparent 1920x1080
stage. No framework and no runtime dependencies on purpose: everything loaded here runs
on every frame of the stream and is a frame-drop risk.

Start reading at `index.html` (the stage) and `src/renderer.ts` (the entry point).

- `src/rendererLog.ts` — structured JSON log lines to the console (the only log OBS has).
- `e2e/` — Playwright tests in real Chromium, run with `pnpm test:e2e`.

`pnpm dev` (repo root) serves it at http://localhost:5174/render/. `pnpm build` writes
`dist/`, which the server serves at `/render/`; point OBS at
`http://<server>:3000/render/` with a 1920x1080 browser source.
