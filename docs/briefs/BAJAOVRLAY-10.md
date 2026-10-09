# Agent brief — BAJAOVRLAY-10: race clock, the first OGraf graphic

**Branch:** `BAJAOVRLAY-10-race-clock-graphic` off `main` (after BAJAOVRLAY-7 is merged).
One PR, left open for João's review. Do not merge.

**Read first:** `CLAUDE.md`; the OGraf v1 spec at
https://ograf.ebu.io/v1/specification/docs/Specification.html and its manifest JSON
Schema at https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json. Our
graphics must be spec-compliant: a `*.ograf.json` manifest plus a JS module whose default
export is a class extending HTMLElement implementing `load`, `dispose`, `playAction`,
`stopAction`, `updateAction`, `customAction`.

## Deliverable

`packages/graphics/race-clock/` — the package every later graphic copies:

- `race-clock.ograf.json`: id `baja-race-clock`, `supportsRealTime: true`,
  `supportsNonRealTime: false`, `stepCount: 1`, `actionDurations` for play/stop (the real
  animation lengths), and a `schema` for the data (below). All user-facing strings in
  pt-BR.
- `src/race-clock.ts`: Lit web component + GSAP for in/out animation. State in a small
  typed model; the DOM is never rebuilt on update — only changed text/class updated.
  Colors and fonts via CSS custom properties with sensible defaults (`--baja-brand`,
  `--baja-font-display`, …) so the renderer's theme can override them later.
- `preview.html`: loads the component with sample data, has buttons for play / stop /
  update with each flag state, and a `?data=` query parameter accepting a JSON payload
  (used by screenshot tests and by the control page later).
- `build` producing an ES module bundle + the manifest + assets into `dist/`, which the
  server will serve under `/graphics/race-clock/`.
- `README.md`: how this package works and how to copy it for a new graphic.

## Data schema (JSON Schema in the manifest)

- `sessionName` string (e.g. "Enduro de Resistência")
- `state` enum: `pre`, `green`, `yellow`, `red`, `checkered`, `finished`
- `clockMode` enum: `elapsed`, `remaining`
- `referenceTimeMs` integer — the elapsed or remaining time at `referenceWallClockMs`
- `referenceWallClockMs` integer — wall-clock ms when `referenceTimeMs` was true; the
  graphic extrapolates locally every frame so updates need not be frequent
- `running` boolean — when false the clock holds at `referenceTimeMs`
- `lapsCompletedByLeader` integer, optional

All keys required except the optional one; `title` on each property in pt-BR.

## Behaviour

- Flag state drives a colour band and a label (VERDE, AMARELA, VERMELHA, QUADRICULADA,
  ENCERRADA); a state change animates the band, never snaps.
- Clock text updates via `requestAnimationFrame`, formatted `H:MM:SS` (drop hours when
  0), never jittering in width (tabular numerals).
- `updateAction` with partial data merges into the model; validation errors return
  `{ statusCode: 400, statusMessage }` instead of throwing.
- `stopAction` animates out and resolves when done; `dispose` cancels the animation
  frame and timelines.

## Tests

- Vitest (jsdom): model merge; time extrapolation with a fake clock (running vs held,
  elapsed vs remaining, reference in the past); formatter table-driven (0 s, 59 s,
  59:59, 1:00:00, negative clamps to 0:00).
- Playwright: lifecycle order against the real component (load → play → update → stop →
  dispose resolve in order; update before play is a 4xx); one screenshot per flag state
  from `preview.html?data=…`, stored as baselines.
- Run the manifest through the OGraf JSON Schema in a test so a bad manifest fails CI.

## Done when

`pnpm --filter race-clock test`, the Playwright suite and the root CI all pass;
`preview.html` shows the clock running; PR description includes the command to open the
preview and the five screenshots.
