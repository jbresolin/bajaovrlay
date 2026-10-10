# Agent brief — BAJAOVRLAY-9: renderer page (layer containers, OGraf lifecycle, reconnect rebuild)

**Branch:** `BAJAOVRLAY-9-renderer-lifecycle` off `main`. One PR, left open for João's
review. Do not merge. Independent of BAJAOVRLAY-11; both are built in sequence, each off main.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §3.2 and §6 (renderer contract) and §19
(decisions); `packages/shared/src/ws/README.md` (protocol); `packages/shared/src/index.ts`
(slices and messages); `packages/graphics/race-clock/README.md` and its `src/race-clock.ts`
as the reference OGraf component; `apps/server/src/core/http/graphicPackages.ts` (how
packages are served: `/graphics/<id>/<manifest.main>`).

## Deliverable

`apps/renderer` becomes a working OGraf renderer that mirrors the `instances` slice.
Framework-free TypeScript only; no new runtime dependencies beyond what `apps/renderer`
already has (zod via `@bajaovrlay/shared` is fine).

**Structure** (one responsibility per file, names say which):

- `src/renderer.ts` — boot: build layer containers, connect, wire the two together. Under
  60 lines.
- `src/serverConnection.ts` — WebSocket client for `/ws`: parses every message with
  `ServerMessageSchema`, exposes `onSlices(callback)`, reconnects with backoff (0.5 s
  doubling to 5 s), and on every (re)connect treats the `hello` as the full truth. Ignores
  `commandResult`. Falls back to `GET /api/v1/state` if `hello` does not arrive within 3 s
  of the socket opening.
- `src/layerContainers.ts` — builds one absolutely positioned child of `#stage` per layer,
  ordered by `zIndex`, `data-layer-id` set; rebuilds only when the `layers` slice changes.
- `src/graphicLoader.ts` — given a `Graphic` from the slice, imports
  `/graphics/<graphic.id>/<manifest.main>` as an ES module (`import()` with a computed
  URL), caches the module per graphic id, and defines the custom element under a tag
  derived from the graphic id (`baja-graphic-race-clock`) if not yet defined.
- `src/instanceReconciler.ts` — the heart: given the previous and next `instances` slice
  for target `program`, decides per layer what to do: nothing / load+play new / replace
  (per layer `replacePolicy`) / stop+dispose. Pure function returning a list of named
  operations; no DOM in it.
- `src/instancePlayer.ts` — executes those operations against the DOM and the OGraf
  lifecycle: create element inside its layer container,
  `await load({ data: resolvedData, renderType: 'realtime', renderCharacteristics: { resolution: { width: 1920, height: 1080 } } })`,
  then `playAction({ goto: 0 })`. On replace with `out-then-in`: `stopAction` old →
  `dispose` → remove element → load+play new; with `cut`: skipAnimation on both;
  `crossfade`: treat as `cut` for M0 and leave a comment. On data change for the same
  instance id: `updateAction({ data: changedKeysOnly })`. Operations on one layer run in
  order; different layers run in parallel.
- `src/rendererLog.ts` (exists) — keep; every lifecycle call and refusal (non-2xx
  statusCode) is logged with instance id, layer and graphic.

**Behaviour rules**

- Only `target: 'program'` instances are rendered on `/render/`. Preview rendering is a
  later task; ignore `preview` instances.
- Reconnect/rebuild: on every `hello`, dispose everything local, then rebuild each on-air
  instance with `skipAnimation: true` so a browser-source refresh in OBS restores the
  screen without replaying in-animations.
- A graphic whose module fails to import, or whose `load` rejects, is logged and leaves its
  layer empty; it never breaks other layers.
- Nothing in the renderer decides *what* is on air. If the slice says it, draw it.
- The renderer sends no commands in M0. Instance status acknowledgement (`loading` →
  `on-air`) is BAJAOVRLAY-12.

**Test fixture:** `apps/renderer/test-fixtures/fake-graphic/` — a minimal OGraf package
(manifest + component) that records every lifecycle call with its arguments on
`window.__fakeGraphicCalls` and resolves after a configurable delay. Playwright serves it
as `/graphics/fake-graphic/`. The race clock is used in one smoke test only.

## Tests (write first)

- `instanceReconciler.test.ts` (Vitest, table-driven): empty → one instance = load+play;
  same id, same data = nothing; same id, changed data = update with only the changed keys;
  new id on an occupied layer = replace with that layer's policy; instance gone =
  stop+dispose; two layers changing at once produce independent operation lists; `preview`
  instances ignored.
- `serverConnection.test.ts` (Vitest with a fake WebSocket): hello delivers slices; a
  malformed message is logged and ignored; reconnect backoff sequence; REST fallback fires
  when hello is late.
- `layerContainers.test.ts` (jsdom): z-order, data attributes, rebuild only on layers
  change.
- Playwright `e2e/lifecycle.e2e.ts` against the fake graphic and a fake WS server (or the
  real server with a temp SQLite — `apps/server/src/core/ws/webSocketTestClient.testSupport.ts`
  shows the pattern): take → load then play, in order; update → `updateAction` with changed
  keys; clear → stop then dispose; replace → old stop/dispose completes before new load;
  reconnect → everything rebuilt with `skipAnimation: true`.
- Playwright `e2e/raceClockOnAir.e2e.ts`: real server, real race-clock build, `takeGraphic`
  via WS, screenshot shows the clock on the stage.

## Done when

Root CI green; with `pnpm dev` running and OBS (or a browser) on
`http://localhost:8080/render/`, a `takeGraphic` sent over WS (use the protocol README's
example with `wscat` or the test client) shows the clock; refreshing the page brings it
back without the in-animation. PR description includes the exact wscat/curl commands João
can paste.
