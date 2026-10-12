# Agent brief — BAJAOVRLAY-14: item forms generated from the graphic's OGraf schema

**Branch:** `BAJAOVRLAY-14-generated-item-forms` off `main`. One PR, left open for João's
review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §3.3, §4, §7 rule 3; `docs/decisions.md`
(everything from PR #5 on about forms, dirty fields, `takeTime`, `updateInstanceData`,
null handling); `packages/graphics/race-clock/race-clock.ograf.json`;
`apps/control/src/features/items/`, `features/playout/`;
`apps/server/src/core/store/graphicDataValidation.ts`.

## Why

Every graphic after the race clock must cost zero control-page code. The manifest's JSON
Schema is the single description of a graphic's data; the editor is generated from it.
The hand-written race-clock form, `raceClockTakeForm.ts`, `itemCommandsFromForm.ts` and
the "Relógio de prova" take panel are deleted in this PR.

## Deliverable

### A. Schema → form (`apps/control/src/features/schemaForm/`)
A renderer that takes an OGraf data schema (JSON Schema draft 2020-12, the subset our
graphics use) and produces a react-hook-form form:
- `string` → text input; with `enum` → select; `format: 'date-time'` → datetime input.
- `integer` / `number` → number input with `minimum`/`maximum`; a `v_baja.unit` of
  `ms` on the property renders as an `mm:ss` duration field (reuse the existing
  `convertMinutesAndSecondsToMilliseconds` from `packages/shared`).
- `boolean` → switch.
- Optional property (not in `required`) → a "limpar" control that sets the field to
  `null`, rendered as cleared; the command path strips `null` on take and sends `null` on
  update (see C).
- Labels from `title`, help from `description`; both pt-BR in the manifests.
- Unsupported schema shapes (arrays, nested objects, oneOf) render a read-only JSON
  textarea with a note; they are not needed before M2 and M3 will extend this file.
- Validation: build a Zod schema from the same JSON Schema for client-side messages (one
  function, `zodSchemaFromDataSchema.ts`, covering the shapes above); the server's Ajv
  check stays the authority.

### B. Field value kinds in the editor
Each field in an item is a `FieldValue`. The editor shows, per field, a small kind
selector where more than one kind applies: `literal` (default) and `takeTime` for any
integer property whose `v_baja.role` is `wallClock`. Add `"v_baja": { "role": "wallClock" }`
to `referenceWallClockMs` in the race-clock manifest and `"v_baja": { "unit": "ms" }` to
`referenceTimeMs`. (M2 adds `binding` and `entity` here.)

### C. Server: `null` in `updateInstanceData`
A top-level `null` in `data` deletes that key from `resolvedData` before validation, so an
optional field can be taken off air. `takeGraphic.data` strips top-level `null`s. Tests
for both; decisions line.

### D. Item editor and the take panel become generic
- `ItemEditorPanel` uses the schema form for any graphic in the `graphics` slice; the
  "editor genérico chega em -14" placeholder is removed. Graphic and layer selects as
  today; layer still defaults to the graphic's `defaultLayerId`.
- The centre take panel is replaced by **"Edição rápida"**: pick a graphic (default: the
  one most recently taken), the schema form appears with the on-air data if that graphic
  is on air on program (any layer), "Colocar no ar" / "Atualizar" using the same
  dirty-field rules as today (`dirtyFields` → form, else on-air; `takeTime` fields resolve
  server-side). No race-clock-specific code anywhere in `apps/control` after this PR;
  add a lint-style unit test that greps `apps/control/src` for `race-clock` and
  `referenceWallClockMs` and fails if found outside the i18n catalog and tests.
- Editing an item that is on air (instance with that `itemId`, program) shows a third
  button, "Atualizar no ar", which saves the item and sends `updateInstanceData` with the
  changed literal fields.

### E. Manifest conventions documented
`packages/graphics/README.md` gains a section "What the control page reads from your
manifest": `title`, `description`, `enum`, `minimum`/`maximum`, `required`,
`v_baja.unit`, `v_baja.role`, `v_baja.defaultLayerId`, `v_baja.category`. Keep it short.

## Tests (write first)
- `schemaForm`: table-driven over a fixture schema with every supported shape → the
  rendered control type, label, help, required marker; the race-clock manifest renders
  the same six fields as the deleted hand-written form; `mm:ss` round trip; clearing an
  optional field yields `null`; an unsupported shape renders the fallback.
- `zodSchemaFromDataSchema`: table-driven; messages in pt-BR name the field.
- Server: `null` deletes on update; `null` stripped on take; schema violation after
  deletion refused.
- Item editor: generic graphic (use a second fixture manifest in test support, e.g.
  `lower-third-fixture`) saves the right `createItem`; "Atualizar no ar" sends
  `updateInstanceData` with changed literals only.
- Edição rápida: follows the on-air instance of the chosen graphic; dirty-field merge
  rows carried over from the deleted tests, rewritten against the generic form.
- The no-race-clock-code guard test.
- E2E: create an item through the generic editor, take it, change one field with
  "Atualizar no ar" → same DOM node in the program stand-in.

## Done when
Root CI green; the race clock is edited and taken only through generated forms;
`git grep race-clock apps/control/src` returns only the catalog and tests. Decisions and
`docs/00-concept.md` §3.3/§4 updated in the PR.
