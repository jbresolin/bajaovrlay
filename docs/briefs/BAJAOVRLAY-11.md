# Agent brief — BAJAOVRLAY-11: minimal control page (app shell, WS client, take/clear, layer status)

**Branch:** `BAJAOVRLAY-11-control-take-clear` off `main`. One PR, left open for João's
review. Do not merge. Independent of BAJAOVRLAY-9; build after it, still off main (never off
its branch).

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §3.4, §7 (operator rules) and §19;
`packages/shared/src/ws/README.md`; `packages/shared/src/index.ts`;
`apps/control/src/i18n/ptBR.ts` (every string goes here);
`packages/graphics/race-clock/race-clock.ograf.json` (the data schema the take form must
satisfy).

## Deliverable

A control page that can take the race clock to air, change its state while on air, clear a
layer, clear all, and always shows what is on every layer. M0 only: no rundown, no items, no
generated forms (BAJAOVRLAY-14 does the generic form); the race-clock form is hand-written
here and will be replaced.

**Structure**

- `src/state/serverConnection.ts` — WebSocket client (same contract as the renderer's but
  independent code; sharing comes later if they converge): parses with
  `ServerMessageSchema`, reconnects with backoff, exposes
  `sendCommand(command): Promise<CommandResult>` that assigns a `requestId` and resolves on
  the matching `commandResult` (rejects after 5 s).
- `src/state/serverStateStore.ts` — Zustand store holding the four slices plus
  `connectionStatus` (`connecting | connected | reconnecting`) and `lastCommandError`. The
  only place server state lives; components read slices via selectors.
- `src/features/layers/LayerStatusPanel.tsx` — one row per layer in z-order: layer name,
  what is on it (graphic name, taken-at time as "há 2 min"), status badge, a **Limpar**
  button per layer. Empty layers say "vazia". Always visible.
- `src/features/playout/TakeRaceClockPanel.tsx` + `raceClockTakeForm.ts` — react-hook-form
  + a Zod schema mirroring the manifest's data schema (sessionName text, state select with
  the six pt-BR labels, clockMode select, running switch, a "tempo de referência" input as
  mm:ss converted to ms, lapsCompletedByLeader optional). Two actions: **Colocar no ar**
  (sends `takeGraphic` on layer `clock` with `referenceWallClockMs: Date.now()`) and, when
  the clock is on air, **Atualizar** (sends `takeGraphic` again with the new data — the
  reducer replaces the instance on the same layer; `updateItemFields` does not exist yet).
  Required-field errors in pt-BR under the field.
- `src/features/playout/ClearAllButton.tsx` — red, always visible, asks for confirmation
  with a second click within 3 s (no browser `confirm()`), sends `clearAll`.
- `src/features/connection/ConnectionBadge.tsx` — connection status in the header; while
  not connected every action button is disabled with a tooltip saying why.
- `src/features/programMonitor/ProgramMonitor.tsx` — an `<iframe src="/render/">` scaled
  to fit a 480×270 box, labelled **Programa**, so the operator sees exactly what OBS shows.
  Just the iframe; no logic.
- `src/app/AppShell.tsx` — three-column desktop layout per §3.4 (left column empty with a
  "Rundown — M1" placeholder, center = program monitor + take panel, right = layer status +
  clear all). Header: title, connection badge.
- Keyboard: `Esc` = clear all (same two-press confirmation), `Backspace` = clear the `clock`
  layer when a non-input element has focus. Space/arrows wait for the rundown.
- shadcn components added: Card, Input, Select, Switch, Badge, Tooltip, Label — copied in
  by hand as before.
- `src/features/<name>/README.md` for each feature folder.

**Rules**

- No literal UI strings: everything through `i18n/ptBR.ts`; add a lint rule or unit test
  that fails on a new hard-coded pt-BR string in `features/` if cheap, else note it.
- Semantic tokens only in styles; no raw hex.
- Dates and relative times through one `formatRelativeTimePtBR` in `src/i18n/`.

## Tests (write first)

- `serverConnection.test.ts` (fake WebSocket): `sendCommand` resolves on its `requestId`,
  rejects on error result, times out; hello and slice messages update the store; a
  malformed message is ignored and logged.
- `serverStateStore.test.ts`: slices replace wholesale on `slice`; connection status
  transitions.
- `raceClockTakeForm.test.ts` (table-driven): valid form → exact `takeGraphic` payload;
  mm:ss → ms conversion rows (0:00, 1:05, 59:59; 1:00:00 invalid for mm:ss); each required
  field missing → the pt-BR message for that field.
- Component tests (Testing Library): LayerStatusPanel shows "vazia" and the graphic name
  per layer, Limpar sends `clearLayer` with the right layerId; ClearAllButton needs two
  presses within 3 s and resets after; buttons disabled while disconnected with the tooltip
  text; TakeRaceClockPanel submits and shows a server error message when the result is
  `ok: false`.
- Playwright `e2e/takeAndClear.e2e.ts` against the real server with a temp SQLite: open
  control, fill the form, Colocar no ar → layer panel shows the clock within 2 s; reload the
  page → panel still shows it (server is the truth); Limpar → vazia. If BAJAOVRLAY-9 is
  merged by then, also assert the program monitor iframe contains the clock element.

## Done when

Root CI green; `pnpm dev` → control page at `localhost:5173`, take the clock, see it on
`/render/` (once -9 is in) and in the layer panel, refresh both pages and nothing is lost.
That is M0's definition of done — say so in the PR description and list the manual steps
João should walk through in OBS.
