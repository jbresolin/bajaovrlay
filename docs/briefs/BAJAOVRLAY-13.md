# Agent brief — BAJAOVRLAY-13: rundown and items — ordering, cursor, take by item

**Branch:** `BAJAOVRLAY-13-rundown-and-items` off `main`, after BAJAOVRLAY-12 is merged. One
PR, left open for João's review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §2 (vocabulary), §4 (rundowns, items,
FieldValue, commands), §7 (operator rules 2 and 6); `docs/decisions.md`;
`apps/server/src/core/store/`; `apps/control/src/features/`.

## Why

Today the control page can only take "the race clock with whatever is in the form". An
*item* is a prepared use of a graphic — graphic + layer + field values — that an operator
sets up before the session and fires with one press. The rundown is the ordered list of
items for a session with a cursor for "next". This task adds both, with literal field
values only; bindings to data sources are M2 (BAJAOVRLAY-20) and the generated editor is
BAJAOVRLAY-14 — here the item editor is a JSON-free minimal form for the race clock,
reusing the existing take-form fields.

## Deliverable

### A. Slices (shared)
- `rundowns`: `{ id, name, sessionLabel, cursorItemId: string | null }`. One rundown is
  seeded on first boot: "Sessão principal".
- `items`: `{ id, rundownId, order, graphicId, layerId, fields, autoOutAfterMs?, label, color, notes }`
  with `fields: Record<string, FieldValue>` and, for M1, `FieldValue` = `{ kind: 'literal', value }`
  only (define the discriminated union now with the single member so M2 adds the others
  without touching callers).
- Both persisted like the existing slices; `instances` gains an optional `itemId`.

### B. Commands (shared + server)
- `createItem` (rundownId, graphicId, layerId, fields, label, order?) — order defaults to
  the end; `updateItemFields` (itemId, fields partial, label?, color?, notes?);
  `deleteItem` (itemId); `reorderItems` (rundownId, orderedItemIds — the full list, refused
  if it is not a permutation of the rundown's items); `moveCursor` (rundownId, itemId | null);
  `takeItem` (itemId) — resolves the item's literal fields into `data` and reuses the
  `takeGraphic` reducer path (import and call it; do not duplicate), stamping `itemId` on
  the instance and moving the cursor to the next item in order; `takeNext` (rundownId) —
  takes the item at the cursor.
- The literal-field resolver lives in `core/store/resolveItemFields.ts` as a pure function
  with a name that will survive M2 (`resolveItemFieldsIntoGraphicData`), today handling
  only `literal`.
- `autoOutAfterMs`: when set, the server schedules a `clearLayer` for that layer after the
  delay, cancelled if the layer changes first. Scheduler in `core/store/autoOut.ts`,
  injectable clock, tested with fake timers.

### C. Control page
- Left column becomes the rundown: list of items in order, each row with color chip,
  label, graphic name, layer, "take" button; the cursor row is highlighted; drag-and-drop
  reorder with dnd-kit sending `reorderItems`; "+ Item" opens the item editor.
- Item editor (`features/items/ItemEditorPanel.tsx`): graphic select (from the `graphics`
  slice), layer select defaulting to the graphic's default layer, label, color (6 fixed
  semantic choices), notes, auto-out (optional, seconds), and the race-clock field form
  reused from the take panel when the graphic is `race-clock`; any other graphic shows
  "editor genérico chega em BAJAOVRLAY-14" and only label/layer. Saves via `createItem` /
  `updateItemFields`.
- Keyboard: `Space` = take the cursor item (`takeNext`), `→` = move cursor forward without
  taking, both ignored while typing. Existing shortcuts unchanged.
- The take panel from M0 stays as the quick manual path; the layer panel shows the item
  label when an instance has `itemId`.

## Tests (write first)
- Shared: all new schemas; `reorderItems` refuses a non-permutation.
- Reducers, table-driven: create appends at end; create with explicit order inserts and
  renumbers; delete renumbers; reorder applies the permutation; moveCursor to an item of
  another rundown refused; takeItem produces the same instance a direct takeGraphic would
  plus `itemId`, and advances the cursor; takeNext with null cursor refused with a pt-BR
  message; `resolveItemFieldsIntoGraphicData` maps literals and refuses a non-literal kind
  with a message that names M2.
- autoOut with fake timers: fires clearLayer after the delay; cancelled by a take on the
  same layer; survives a server restart only as "not rescheduled" — document that choice.
- Control components: rundown renders items in order with the cursor highlighted; drag
  reorder sends the full permutation; item editor builds the right `createItem`; Space
  sends `takeNext`; `→` sends `moveCursor`.
- E2E: create two clock items, take the first with Space, panel shows its label, cursor
  moves to the second, reload keeps the rundown.

## Done when
Root CI green; an operator can prepare three clock items before a session and fire them
with Space in order, with the layer panel naming the item on air. `docs/00-concept.md` §4
and `docs/decisions.md` updated in the PR.
