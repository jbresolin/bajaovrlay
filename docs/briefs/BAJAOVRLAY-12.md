# Agent brief — BAJAOVRLAY-12: layers and instances — in-place update, renderer acknowledgement, replace policies

**Branch:** `BAJAOVRLAY-12-instances-update-and-ack` off `main`. One PR, left open for João's
review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §4 (state model), §6 (renderer
contract), §19 (decisions); `docs/decisions.md` (everything after "PR #4 (gate 2)");
`apps/server/src/core/store/README.md` and `reducers/`; `apps/renderer/src/instanceReconciler.ts`
and `instancePlayer.ts`; `packages/shared/src/ws/README.md`.

## Why

At M0 every change to an on-air graphic is a second `takeGraphic`, so the graphic animates
out and back in. The OGraf `updateAction` exists for exactly this and the renderer already
calls it when `resolvedData` changes for the *same* instance id — but no command produces
that situation. This task adds the command, lets the renderer report what is really on
screen, and finishes the layer model the rest of M1 builds on.

## Deliverable

### A. `updateInstanceData` command (shared + server)
- Schema: `{ type: 'updateInstanceData', instanceId, data: partial object }`.
- Reducer: find the instance; merge `data` over `resolvedData` (shallow, top-level keys);
  validate the merged object against the graphic's manifest `schema` (JSON Schema, Ajv —
  already a dependency of the race-clock tests; add it to the server) and refuse with a
  pt-BR message naming the field if invalid; keep `instance.id` unchanged so the renderer
  updates in place. Unknown instance → `INSTANCE_NOT_FOUND`.
- Also validate `takeGraphic.data` against the manifest schema in the same way (today an
  invalid take reaches the graphic and is refused there; refuse it at the server instead).
  Put the validator in `core/store/graphicDataValidation.ts`, one function, cached
  compiled schemas per graphic id.
- Control page: "Atualizar" on the race-clock panel sends `updateInstanceData` with only the
  dirty fields (plus the carried-forward time fields when the time is dirty). "Colocar no
  ar" stays `takeGraphic`. Remove the replace-based Atualizar path and its tests.

### B. Renderer acknowledgement (shared + server + renderer)
- New client message `instanceStatus` `{ type: 'instanceStatus', instanceId, status: 'on-air' | 'failed', detail? }`
  sent by the renderer after `playAction` resolves (or after a failed import/load).
- Server: a new command `reportInstanceStatus` behind it (same single code path), allowed
  only for an actor with role `renderer`. Until login exists, a WS connection identifies as
  renderer by connecting to `/ws?role=renderer`; the actor becomes `renderer:<connection id>`.
  The authorize hook refuses `reportInstanceStatus` from any other actor — the first real
  use of that hook; test it.
- Reducer: `loading → on-air` or `loading → failed` (new status value; add it to
  `InstanceStatusSchema`). A `failed` instance stays in the slice (visible in the layer
  panel with the detail) until cleared or replaced; it is never auto-removed.
- Control page: layer panel shows `on-air` as a green badge, `loading` as grey, `failed` as
  red with the detail in a tooltip, all through the pt-BR catalog.

### C. Manifest-declared default layer
- Read `v_baja.defaultLayerId` (and optional `v_baja.category`) from each manifest when
  building the `graphics` slice. Unknown or missing → `fullscreen` with a logged warning
  (existing behaviour). Remove the hard-coded `race-clock → clock` mapping and add
  `"v_baja": { "defaultLayerId": "clock", "category": "clock" }` to the race-clock manifest.
  The manifest test must still pass the OGraf schema (`v_` fields are allowed).

### D. Replace policies in the renderer
- `cut`: load the new element first (hidden, `skipAnimation`), then `stopAction` +
  `dispose` the old with `skipAnimation`, then play the new with `skipAnimation`. The layer
  is never empty between the two.
- `crossfade`: keep treating as `cut`; leave the comment. No seeded layer uses it.
- Server-side `clearLayer` unchanged.

### E. Renderer follow-ups from gate-2
- Slow lifecycle call: after 10 s awaiting `load` or `playAction`, log a `warn` with
  instance id, layer and graphic. Do not abandon the call.
- Failed import retry: when a take arrives for a graphic whose previous import failed in
  this page, import `…/<main>?retry=<n>` with an incrementing `n`, so "rebuild package,
  retake" works without refreshing the browser source. Log it.

## Tests (write first)
- Shared: `updateInstanceData`, `reportInstanceStatus`, `instanceStatus` message schemas —
  valid, missing field named, unknown status refused.
- Server reducers, table-driven: update merges top-level keys and keeps the instance id;
  update refused on schema violation names the field; update on unknown instance refused;
  status transitions `loading→on-air`, `loading→failed`, `on-air→on-air` is a no-op
  returning the same array; take with invalid data refused before anything changes.
- Server authorize: `reportInstanceStatus` accepted from `renderer:*`, refused from
  `operador:*` with `NOT_ALLOWED`; `takeGraphic` from `renderer:*` refused.
- Server WS: a connection with `?role=renderer` gets that actor; without it, `operador`.
- Graphics slice: default layer read from `v_baja`; missing → fullscreen + warning.
- Renderer: reconciler emits `update` (not replace) when only `resolvedData` differs for
  the same id — already covered; add: `cut` operation order (new loaded before old
  disposed) against the fake graphic in Playwright; `instanceStatus` sent after play
  resolves and after a load failure; slow-call warning with a fake timer; retry import URL
  increments.
- Control: Atualizar sends `updateInstanceData` with dirty fields only; the e2e
  `takeAndClear` adds "change the flag → the race-clock element in the program monitor is
  the same DOM node as before" (no blink).

## Done when
Root CI green; in OBS, changing the flag with Atualizar changes the band without the
clock leaving the screen; the layer panel shows `No ar` for the clock within a second of
take; a take with an invalid payload sent over WS is refused with a pt-BR message naming
the field. Decisions appended to `docs/decisions.md`; `docs/00-concept.md` §4 updated with
the new command, status value and message (one commit in this PR, documentation).
