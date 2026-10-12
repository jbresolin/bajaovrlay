# @bajaovrlay/renderer

The page OBS loads as a browser source: a transparent 1920x1080 stage that mirrors one output
of the server's `instances` slice with OGraf graphics. Framework-free on purpose. Start at
`src/renderer.ts` (the wiring), then follow one delivery of slices:

- `src/rendererPageRole.ts` — the address decides the role: `/render/` is the program renderer, the only page that reports; `/render/?monitor=1` (program monitor) and `/render/?target=preview` (draws the `preview` output; framed with `&monitor=1`) dial plain `/ws` and never send `instanceStatus`.
- `src/serverConnection.ts` — WebSocket to `/ws?role=renderer`; sends `instanceStatus`; records each message's `serverNowMs` so graphics count on the server's clock.
- `src/layerContainers.ts` — one container per layer; `src/instanceReconciler.ts` — pure:
  previous and next instances of the drawn output in, named operations out (preview: every replace is a `cut`).
- `src/instancePlayer.ts` — runs them, one queue per layer, and reports each instance as
  `on-air` or `failed`. `e2e/` — Playwright in real Chromium, with `test-fixtures/fake-graphic`.

`pnpm dev` serves http://localhost:5174/render/ (forwards `/ws`, `/api`, `/graphics`); OBS: `http://<server>:<PORT>/render/`.
