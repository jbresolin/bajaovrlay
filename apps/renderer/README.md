# @bajaovrlay/renderer

The page OBS loads as a browser source: a transparent 1920x1080 stage that mirrors the
server's `instances` slice (program output only) with OGraf graphics, and tells the server
how each one went (`instanceStatus`: `on-air`, or `failed` with the reason). Framework-free
on purpose. Start at `src/renderer.ts` (the wiring), then follow one delivery of slices:

- `src/serverConnection.ts` — WebSocket to `/ws?role=renderer`: reconnect, HTTP fallback for
  a late hello, and the one message the renderer sends.
- `src/layerContainers.ts` — one container per layer on the stage, stacked by `zIndex`.
- `src/instanceReconciler.ts` — pure: previous and next instances in, named operations out.
- `src/instancePlayer.ts` — runs them, one queue per layer, and reports each instance. A
  `cut` loads the new graphic hidden behind the old one, so the layer is never empty.
  `instanceLoading.ts` creates and loads an element, `lifecycleCall.ts` makes and logs each
  call (and warns after 10 s), `graphicLoader.ts` imports modules (`?retry=<n>` after a
  failure), `rendererLog.ts` logs. Tests use the stand-ins in `*.testSupport.ts`.
- `e2e/` — Playwright in real Chromium (`pnpm test:e2e`), with `test-fixtures/fake-graphic`.

`pnpm dev` serves http://localhost:5174/render/ and forwards `/ws`, `/api`, `/graphics` to the
server. `pnpm build` writes `dist/`; point OBS (1920x1080) at `http://<server>:<PORT>/render/`.
