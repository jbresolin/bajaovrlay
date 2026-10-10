# @bajaovrlay/renderer

The page OBS loads as a browser source: a transparent 1920x1080 stage that mirrors the
server's `instances` slice (program output only) with OGraf graphics. Framework-free on
purpose. Start at `src/renderer.ts` (the wiring), then follow one delivery of slices:

- `src/serverConnection.ts` — WebSocket to `/ws`, reconnect, HTTP fallback for a late hello.
- `src/layerContainers.ts` — one container per layer on the stage, stacked by `zIndex`.
- `src/instanceReconciler.ts` — pure: previous and next instances in, named operations out.
- `src/instancePlayer.ts` — runs them: elements and the OGraf lifecycle (`lifecycleCall.ts`
  makes and logs each call, `graphicLoader.ts` imports modules, `rendererLog.ts` logs);
  `instancePlayer.test.ts` proves its queue with the stand-ins in `*.testSupport.ts`.
- `e2e/` — Playwright in real Chromium (`pnpm test:e2e`), with `test-fixtures/fake-graphic`.

`pnpm dev` serves http://localhost:5174/render/ and forwards `/ws`, `/api`, `/graphics` to the
server. `pnpm build` writes `dist/`; point OBS (1920x1080) at `http://<server>:<PORT>/render/`.
