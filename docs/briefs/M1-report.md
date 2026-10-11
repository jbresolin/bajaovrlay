# M1 report

One section per round of work on milestone M1, newest at the bottom.

## Round 1 — 2026-10-10

Two tasks were worked through in order, BAJAOVRLAY-12 and BAJAOVRLAY-13, each on its own branch
cut from `main`, with tests written first. Each branch was then read by four independent
reviewers (server and shared, renderer, control page, brief and style compliance), a sceptic
tried to refute every finding, and every confirmed finding was fixed before pushing. Both pull
requests are open and neither was merged. No task was blocked.

### Status at a glance

| Task | PR | State | CI |
| --- | --- | --- | --- |
| BAJAOVRLAY-12 in-place update, renderer acknowledgement, cut | [#7](https://github.com/jbresolin/bajaovrlay/pull/7) | **Open, waiting for your review** | green |
| BAJAOVRLAY-13 rundown and items | [#8](https://github.com/jbresolin/bajaovrlay/pull/8) | **Open, waiting for your review** | green |

Local counts: PR #7 has 555 unit tests and 48 Playwright tests; PR #8 has 697 unit tests and 40
Playwright tests. PR #8 has fewer Playwright tests because it does not contain PR #7's.

### What was built

- **BAJAOVRLAY-12 (PR #7).** `updateInstanceData` changes a graphic on air in place: the sent
  fields are laid over `resolvedData`, checked against the manifest's JSON Schema with Ajv, and
  the instance id is kept, so the renderer calls `updateAction` instead of animating out and in.
  `takeGraphic` data is checked the same way. The renderer connects as `/ws?role=renderer` and
  reports `on-air` or `failed` per instance; the authorize hook lets only a renderer send that
  report. The layer panel shows "No ar", "Carregando" and "Falhou" badges. A graphic's default
  layer comes from `v_baja` in its manifest. `cut` loads the new graphic before disposing the
  old one. A slow `load` or `playAction` logs a warning after 10 s, and a take after a failed
  import retries it. "Atualizar" on the race-clock panel sends only the changed fields.
- **BAJAOVRLAY-13 (PR #8).** `rundowns` and `items` slices, with `FieldValue` as a union that
  has only `literal` for now, and `itemId` on an instance. Seven commands (`createItem`,
  `updateItemFields`, `deleteItem`, `reorderItems`, `moveCursor`, `takeItem`, `takeNext`), each
  a pure reducer in its own file; `takeItem` calls the `takeGraphic` reducer by import. An
  auto-out scheduler clears the layer after an item's delay. The control page's left column is
  the rundown, with dnd-kit reorder, an item editor that reuses the race-clock fields, `Space`
  for take-next and `→` for the cursor, and the item's label in the layer panel.

### Rulings already given and applied (PR #7)

1. A renderer's report moves `loading → on-air`, `loading → failed` and `on-air → failed`;
   `failed → anything` and `on-air → on-air` change nothing.
2. An accepted command whose reducer returns unchanged slices writes no event-log row and
   broadcasts nothing; a refused command is still logged. `docs/00-concept.md` §3 was changed by
   one sentence to say so.
3. "Atualizar" cannot remove the laps: accepted gap, with the pointer to "Colocar no ar";
   BAJAOVRLAY-14 adds a per-field clear.
4. `UNAUTHORIZED_COMMAND` stays in the shared list with a dated comment.
5. The control e2e waits 3 s for "No ar".
6. The Vite `ws proxy error: write EPIPE` line is noted in the e2e README as teardown noise. It
   was seen in two local runs, failed no test, and its cause is not confirmed.

### What is waiting for you

1. **Review PR #7 and PR #8.** Each description says which tests to read first, the commands to
   see it working, and its decisions.
2. **Merge order: PR #7 first, then PR #8.** PR #8 was cut from `main` before PR #7 merged, as
   instructed. A read-only merge prediction shows three textual conflicts, all documentation:
   - `docs/decisions.md` — both append at the bottom; keep both blocks, PR #7's first.
   - `apps/server/src/core/store/README.md` — keep PR #7's bullets, then PR #8's one bullet, and
     trim to 15 lines.
   - `apps/control/e2e/README.md` — take PR #7's text and add the bullet for
     `rundownTakeWithSpace.e2e.ts`.

   `packages/shared/src/index.ts` merges cleanly; PR #8 adds one export line there.
3. **After the second merge, expect one typecheck break git does not flag.** PR #7's
   `raceDaySlices.testSupport.ts` must also return `rundowns: []` and `items: []` and pass
   `newItemId`. The merged tree was never built or tested, so these also need a look: ruling 2
   applied to PR #8's commands that change nothing, the authorize rule against the
   `sistema:auto-out` actor, and manifest validation of an item's fields at take time.
4. **Decisions that need you**, below.

### Decisions that need you

PR #7:

- **The program monitor reports as a renderer too.** "No ar" means some renderer page played
  the graphic, not specifically OBS, and a failure in the monitor alone turns the badge to
  "Falhou". If only OBS should report, the monitor needs a non-reporting mode.
- **The failed-badge tooltip is CSS-only**, because the Radix tooltip used up the first press of
  Esc. It has not been seen in a browser.
- **"Time is dirty" is read as "time, clock mode or running is dirty"** when deciding whether
  "Atualizar" sends the reference time.
- **New pt-BR wording** for the badges, the tooltip and the refusal messages.

PR #8:

- **A clock item saved running counts from the moment it was saved**, not from the take. Fixing
  that needs a server rule or an M2 binding.
- **The item editor shows colour, notes and auto-out for every graphic**, where the brief says
  "only label/layer" for graphics other than the race clock.
- **Space after clicking a row's "Disparar"** presses that button again instead of taking the
  next item.
- **`→` only moves the cursor forward**; nothing moves it back or onto a chosen row.
- **"Excluir" deletes on the first press**, and deleting the cursor item moves the cursor to the
  following one.
- **A saved item's graphic and layer cannot be changed.**
- **Auto-out is not rescheduled after a server restart.**

### Not verified

- Nothing was checked in OBS itself. The control e2e proves in Chromium that the race-clock
  element survives a flag change as the same DOM node.
- "No ar within a second" has no automated proof; the e2e allows 3 s.
- Mouse dragging, the drag animation and the six row colours were not checked by eye.
- The equal-contents case of ruling 2: an `updateInstanceData` that sends the values already on
  air builds a new array, so it is still saved, logged and broadcast.
- The Plane page "00 — Concept & Architecture" was not edited and needs the §3 and §4 wording
  that `docs/00-concept.md` has in the two PRs.

### Housekeeping

- `docs/briefs/BAJAOVRLAY-12.md` and `docs/briefs/BAJAOVRLAY-13.md` are untracked on your
  machine and are in neither PR.
- Each Plane item has a comment listing its commits and tests.
