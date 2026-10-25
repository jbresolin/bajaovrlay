# Agent brief — BAJAOVRLAY-45: the item editor stays fast during a race

**Branch:** `BAJAOVRLAY-45-fast-item-editor`, cut from an up-to-date `main` (after PR #27).

Follow CLAUDE.md's process:

* open a draft PR;
* run `pnpm verify` before every push;
* report, then stop;
* do not merge.

**Measure before you change anything.** Where the brief leaves a choice open, take the plainer
option, record it in `docs/decisions.md` and under "Decisions taken", and move on.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md` and `docs/ci.md`;
* `apps/control/src/state/` (the store and `useServerState`);
* `apps/control/src/features/items/`:
  + `ItemEditorPanel.tsx`
  + `ItemGraphicFieldsForm.tsx`
  + `useBindingOptionsOfItemEditor.ts`
  + `useItemEditorSaves.ts`
* `apps/control/src/features/schemaForm/`:
  + `SchemaFormFields.tsx`
  + `SchemaFormFieldRow.tsx`
  + `BoundFieldControls.tsx`
  + `EntityReferenceControls.tsx`
  + `bindingValueNowText.ts`
* the walk `apps/control/e2e/podiumBattleQrWalk.e2e.ts`. Gate 2 of PR #27 had to bind the battle
  card with the simulator off, because the editor stalled.

## Why

Two reviews measured this, on a 2-core machine:

* **Gate 2 of PR #25:** a dropdown pick re-renders the whole form, taking 110–370 ms on a fast
  machine.
* **Gate 2 of PR #27:** with the simulator at speed 60 and about 11 live bindings open in the
  editor, each click got slower. It went from 0.2 s to 16 s by the 6th bound field. "Salvar e
  disparar" then took 71 s to register, and ended with "O servidor não respondeu em 5 segundos".

A battle card is exactly such an item, and the event laptop will be slower than a dev
machine. Operators edit items while a race runs, so the editor must stay responsive then.

**Likely causes (verify them; don't assume):**

* `ItemGraphicFieldsForm` and `useBindingOptionsOfItemEditor` subscribe to the whole
  `dataSnapshots` and `dataSources` slices. Every poll then re-renders the whole form and
  rebuilds every field's binding path list and "Valor agora" text.
* `ItemEditorPanel` subscribes to the whole `instances` slice, which changes on every live
  refresh of anything on air.
* Each `SchemaFormFieldRow` may recompute its path list and options on every render, with no
  memoisation, and react-hook-form `watch()` may re-render the whole form on any keystroke.

## Deliverable

### A. Measure first (commit 2)

**A performance guard test** in `apps/control/e2e`, on the real server:

1. open a battle-card item with its typical live bindings (about 11 fields bound to
   `positions.entryOfCar.<n>`);
2. run the simulator at speed 60;
3. measure the time from a click on a field's dropdown to its options showing, and from
   "Salvar" to the saved state.

Record the numbers on 2 cores (`taskset -c 0,1`) in the PR as the baseline.

**A React Profiler (or render-count) measurement** in a component test: how many times each
field row renders when one snapshot arrives that changes nothing the editor shows, and when
one field changes. Record those as the baseline too.

### B. Fix, guided by the measurements

**Targets:**

* A snapshot that changes nothing a field shows re-renders no field row.
* A snapshot that changes one bound value re-renders only the rows that show it, at most
  that row's "Valor agora".
* A pick in one field re-renders only that field.
* On 2 cores, with the simulator at speed 60 and 11 live bindings, a dropdown opens in under
  300 ms and a save registers in under 1 s.

**Plain means, in this order (prefer the first that meets the target):**

1. **Narrow subscriptions.** Select only what a component shows: the sources list for the
   pickers, and per field the one value its binding resolves to, through a selector with a
   shallow or primitive comparison. Never subscribe the whole form to `dataSnapshots`.
2. **Compute path lists once per source shape, not per render.** The paths of a shape don't
   change with its values. Cache them keyed on the source's shape and identity, in a named
   module with a test, not inline `useMemo` sprawl.
3. **Memoise the rows.** Use `React.memo` on the field row with stable props, and
   react-hook-form's `useWatch` per field instead of a form-wide `watch()`.

No new state library and no virtualisation library. If you think one is needed, show the
measurement and ask in the PR description.

**Rule 1 still holds.** The editor keeps no copy of server state. Derived values are computed
from the store.

### C. Revert the walk's workaround

In `podiumBattleQrWalk.e2e.ts`, bind the battle card **with the simulator running** again,
as an operator would. The workaround comment goes. This is the proof that the fix works where
it hurt.

### D. Docs

* The README of `features/items` and `features/schemaForm`: a short "what re-renders when"
  paragraph.
* A decisions line for each choice.

## Tests (write first)

* **Render counts** (component tests, Testing Library plus React Profiler `onRender` or a
  counting wrapper):

  + a no-change snapshot gives 0 row renders;
  + a one-value snapshot re-renders only that row;
  + a pick re-renders only that field;
  + typing in one text field doesn't re-render the others.

  Each test fails on `main` before the fix: say so in the report, with the numbers.
* **The path-list cache:** computed once per shape, and recomputed when a source's shape or
  identity changes.
* **The performance guard e2e:** thresholds generous enough for CI's 2 cores but tight enough
  to catch the old behaviour. Use the measured baseline: for example, fail above 1 s for a
  dropdown and 3 s for a save. Use web-first waits; time only with `performance.now()` around
  the action.
* **Everything existing stays green,** with unchanged behaviour: bindings, "Valor agora",
  entity references, entity lists, transforms.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-45.md`.
2. The measurements:
   * the render-count tests, marked with `it.fails` until the fix, then flipped;
   * the performance guard, marked with `test.fail` until the fix, then flipped;
   * the baseline numbers in the commit message.
3. The fixes, one commit per mean, with before/after numbers in each message.
4. The walk with the simulator running.
5. Docs and decisions.

## Done when

* `pnpm verify` is green.
* The render-count tests and the guard pass.
* The PR has a before/after table:
  + row renders per snapshot;
  + dropdown open time;
  + save time, on 2 cores.
* On João's machine, editing a battle card while the simulator runs at speed 60 feels instant.

The PR description has the walk, "Decisions taken", and what was left out and why. Report
and stop. João marks the PR ready after gate 2.
