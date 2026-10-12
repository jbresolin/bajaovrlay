# @bajaovrlay/renderer

The page OBS loads as a browser source: a transparent 1920x1080 stage that mirrors the
server's `instances` slice (program output only) with OGraf graphics. Framework-free on
purpose. Start at `src/renderer.ts` (the wiring), then follow one delivery of slices:

- `src/rendererPageRole.ts` — `/render/` is the program renderer; `/render/?monitor=1` (framed
  by the control page) is a monitor: it dials plain `/ws` and never sends `instanceStatus`.
- `src/serverConnection.ts` — WebSocket to `/ws?role=renderer`; sends `instanceStatus`; records each message's `serverNowMs` so graphics count on the server's clock.
- `src/layerContainers.ts` — one container per layer; `src/instanceReconciler.ts` — pure:
  previous and next instances in, named operations out.
- `src/instancePlayer.ts` — runs them, one queue per layer, and reports each instance as
  `on-air` or `failed`. `e2e/` — Playwright in real Chromium, with `test-fixtures/fake-graphic`.

`pnpm dev` serves http://localhost:5174/render/ (forwards `/ws`, `/api`, `/graphics`); OBS: `http://<server>:<PORT>/render/`.
