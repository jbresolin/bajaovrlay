# @bajaovrlay/renderer

The page OBS loads as a browser source: a transparent 1920x1080 stage that mirrors the server's
`instances` slice (the program output, or on the preview page the screen after the take) with OGraf graphics. Framework-free on purpose. Start at
`src/renderer.ts` (the wiring), then follow one delivery of slices:

- `src/rendererPageRole.ts` — the address decides the role: `/render/` is the program renderer, the only page that reports; `/render/?monitor=1` (program monitor) and `/render/?target=preview` ("Prévia"; framed with `&monitor=1`) dial `/ws?role=monitor` and never send `instanceStatus`. Each page reads `/api/v1/state` with its own role when its hello is late, so no renderer page is sent the race data or the event log.
- `src/previewComposition.ts` — pure: what the preview page draws, the screen after the take: per layer the preview instance, else nothing if the layer is in `previewClearedLayerIds`, else the program instance.
- `src/serverConnection.ts` — WebSocket to `/ws?role=renderer`; one delivery per `hello`, `slice` or `slices` message (one state change); sends `instanceStatus`; records each message's `serverNowMs` so graphics count on the server's clock.
- `src/layerContainers.ts` — one container per layer; `src/operationsPerDelivery.ts` remembers the last delivery and asks `src/instanceReconciler.ts` — pure:
  two deliveries in (program: program instances; preview: the composition), named operations out (preview: every replace is a `cut`).
- `src/instancePlayer.ts` — runs them, one queue per layer, and reports each instance as `on-air` or `failed`. `e2e/` — Playwright in real Chromium, with `test-fixtures/fake-graphic`.

`pnpm dev` serves http://localhost:5174/render/ (forwards `/ws`, `/api`, `/graphics`); OBS: `http://<server>:<PORT>/render/`.
After updating the server, refresh the OBS browser sources: an old renderer page rejects the new `slices` message.
