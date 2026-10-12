# Agent brief — BAJAOVRLAY-16: quick-fire panels, macros, keyboard map

**Branch:** `BAJAOVRLAY-16-quickfire-and-macros` off `main`, after BAJAOVRLAY-15 is
merged. One PR, left open for João's review. Do not merge. This closes M1.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §2 (macro), §4 (macros slice), §7 rules
2, 5 and 6; `docs/decisions.md` on keyboard behaviour; `apps/control/src/features/keyboard/`,
`features/rundown/`, `features/playout/`.

## Why

The rundown covers the scripted parts; quick-fire panels cover "the ten things we do
every hour". Macros make one press do several commands. Together with -15 this is the
whole M1 operator loop: prepare, preview, take, clear.

## Deliverable

### A. Quick-fire panels (shared + server + control)
- Slice `quickFirePanels`: `{ id, name, order }`. Items already carry
  `rundownId | quickFirePanelId`; make that a proper union in the item schema
  (`home: { kind: 'rundown', rundownId } | { kind: 'quickFire', panelId }`) with a
  migration that converts existing rows. One seeded panel: "Atalhos".
- Commands: `createQuickFirePanel`, `renameQuickFirePanel`, `deleteQuickFirePanel`
  (refused if it has items), `moveItemToHome` (item → rundown or panel, with order).
- Control: right column, above the layer panel, a tabbed strip of panels; each panel is
  a grid of buttons (item colour as background, label, graphic name small); click =
  `takeItem`; right-click or a small ⋯ = Prévia / Editar / Mover para rundown. Items
  are created in a panel through the same item editor with a "Onde" selector.
- Panel buttons never move the rundown cursor (they are ad hoc by definition — the
  reducer already does this; add the test row).

### B. Macros (shared + server + control)
- Slice `macros`: `{ id, label, color, steps: MacroStep[] }` where a step is one of
  `{ kind: 'takeItem', itemId }`, `{ kind: 'clearLayer', layerId }`, `{ kind: 'clearAll' }`,
  `{ kind: 'wait', ms }` (max 10 000). OBS scene steps arrive in M4.
- Command `runMacro` (macroId): executed by a server-side runner (`core/store/macroRunner.ts`,
  injectable clock, like autoOut) that applies each step through `applyCommand` with
  actor `sistema:macro:<macroId>`; the authorize hook allows that actor the step
  commands only. A failing step stops the macro and logs it; nothing is rolled back
  (on-air state is never undone automatically — decisions line).
- Steps run strictly in order; `wait` delays the next step. A macro cannot start while
  another is running (refused with a pt-BR message).
- Control: a "Macros" tab in the quick-fire strip; macro editor is a vertical list of
  steps with add/remove/reorder (dnd-kit) and pickers for items and layers; run button
  on the tab grid like items. While a macro runs, its button shows a running state from
  a `macroRuns` slice `{ macroId, startedAt, currentStep }` (cleared when done).

### C. Keyboard map, finished for M1
- One file, `features/keyboard/keyboardMap.ts`, is the single source of truth for every
  shortcut: key, condition, command, pt-BR description. The existing hooks read from it.
- Map: `Space` take (preview or next, per -15), `Shift+Space` preview cursor item,
  `→`/`←` cursor, `Backspace` stop preview / clear clock layer, `Esc` clear all
  (two-press), `1`–`9` fire the first nine buttons of the active quick-fire tab,
  `F1`–`F4` switch quick-fire tabs. All ignored while typing, as today.
- A "?" button in the header opens a dialog listing the map (generated from the file).

### D. Operator-facing polish that fell out of the walks
- Layer panel rows show the item colour chip when the instance came from an item.
- The hint under an empty rundown and the "Fim do rundown" text are kept; add the same
  pattern for an empty quick-fire panel ("Crie um item aqui para ter um atalho").

## Tests (write first)
- Shared schemas, item-home migration (old rows with `rundownId` convert, with
  `quickFirePanelId` convert, neither → refused at boot).
- Reducers: panel CRUD rules; moveItemToHome renumbers both sides; macro runner with
  fake clock: order, wait, stop-on-failure, concurrent-run refusal, actor authorised for
  step commands only.
- Control: quick-fire grid fires `takeItem`; `1`–`9` map to the active tab; macro editor
  builds the right `steps`; running state shown; the "?" dialog lists every map entry.
- E2E: an item in a panel fired with `1` goes to air without moving the cursor; a macro
  of take + wait 500 + clearLayer leaves the layer empty after ~0.5 s.

## Done when
Root CI green; a rehearsal show can be run from the control page alone: rundown with
Space, a shortcuts panel with number keys, one macro that opens the session (clock on,
bug on). That is M1's definition of done; say so in the PR and list the walk for João.
Decisions and `docs/00-concept.md` §4/§7 updated in the PR.
