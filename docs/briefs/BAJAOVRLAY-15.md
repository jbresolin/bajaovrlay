# Agent brief — BAJAOVRLAY-15: preview and program monitors

**Branch:** `BAJAOVRLAY-15-preview-target` off `main`, after BAJAOVRLAY-14 is merged. One
PR, left open for João's review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §6, §7 rule 1 ("nothing goes to air
without being visible first"); `docs/decisions.md` on `target`, the monitor page
(`?monitor=1`), and instance status; `apps/renderer/src/`; `apps/server/src/core/store/`;
`apps/control/src/features/programMonitor/`.

## Why

The operator must see an item rendered before taking it, with the same pixels OBS will
show. The `target: 'preview'` instances already exist in the state model; nothing
renders or creates them yet.

## Deliverable

### A. Commands (shared + server)
- `previewItem` (itemId): resolves the item exactly like `takeItem` (same resolver, same
  validation) but creates the instance with `target: 'preview'` on the item's layer,
  replacing any previous preview instance on that layer, and does not touch the cursor
  or program.
- `previewGraphic` (graphicId, layerId, data): same for ad-hoc data from Edição rápida.
- `stopPreview` (layerId | all).
- `takePreview` (layerId): promotes the preview instance on that layer to program — a
  new program instance with the same `graphicId`, `itemId`, `resolvedData`; the preview
  instance is removed; cursor rule as `takeItem` (advance only if that item was the
  cursor). Resolution is NOT redone, so what was seen is what goes to air, with one
  exception: `takeTime` fields are re-resolved at take (the clock must start at the take,
  not at the preview). Record that exception where the resolver is called.
- Preview instances are not persisted across a server restart (they are scaffolding, not
  state the show depends on) — hydrate drops them. Decisions line.

### B. Renderer: preview mode
- `/render/?target=preview` renders only `target: 'preview'` instances, never reports
  status (like the monitor), and ignores `cut`/`out-then-in` ordering subtleties by
  always using `skipAnimation` for replace — preview is for looking, not for animation
  review. One flag in `renderer.ts` and the reconciler; no second code path.
- `/render/` (program) keeps ignoring preview instances.

### C. Control page
- Centre column: two monitors side by side at 480×270 each, **Prévia** (left, iframe
  `/render/?target=preview&monitor=1`) and **Programa** (right). Under Prévia: the layer
  and item label of what is previewed, a **Tomar** button (sends `takePreview` for that
  layer) and **Descartar** (`stopPreview`).
- Rundown rows get a **Prévia** button next to Disparar; selecting a row with the cursor
  (`←`/`→`, click) also previews it automatically — configurable with a header toggle
  "Prévia automática", default on, stored per browser in localStorage (the one allowed
  per-viewer convenience).
- Edição rápida gets a **Prévia** button that sends `previewGraphic`.
- Keyboard: `Space` = if a preview is showing for the cursor item, `takePreview` on its
  layer; otherwise `takeNext` as today. `Shift+Space` = preview the cursor item.
  `Backspace` = `stopPreview` for the previewed layer when a preview is showing,
  else as today.
- Layer panel: a small "em prévia" chip on a layer that has a preview instance.

## Tests (write first)
- Reducers, table-driven: previewItem creates a preview instance and leaves program and
  cursor alone; a second preview on the same layer replaces the first; takePreview moves
  data unchanged except `takeTime` fields; takePreview with nothing previewed refused;
  stopPreview all; hydrate drops preview instances.
- Renderer: `?target=preview` renders preview instances only and sends no status; program
  page ignores preview instances (already covered — keep).
- Control components: Prévia buttons send the right commands; auto-preview follows the
  cursor and respects the toggle; Space/Shift+Space/Backspace routing table-driven.
- E2E: preview an item → appears in the Prévia stand-in page and not in the program
  stand-in; Tomar → appears in program, Prévia empties; reload keeps program, loses
  preview.

## Done when
Root CI green; in OBS, an item previewed and taken shows exactly what the Prévia monitor
showed; auto-preview makes `→` then `Space` the whole operator loop. Decisions and
`docs/00-concept.md` §6/§7 updated in the PR.
