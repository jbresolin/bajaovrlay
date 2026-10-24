# race-clock (`@bajaovrlay/race-clock`)

The race clock OGraf graphic in Ardósia: the card top-right of the stage with the white logo
and the session title in its head, the caption line (clock mode, leader laps) over the running
race time, and the optional flag band. `race-clock.ograf.json` is what a renderer reads; its
`main` points at the default export of `src/race-clock.ts` (a Lit element), which only wires
the pure modules beside it: data model, time (the sum, its H:MM:SS text — shared with the
control page's session card — and the server-aligned "now" it counts with, never `Date.now()`,
are `@bajaovrlay/shared/clock`), frame loop, GSAP animations, `ptBR.ts`.
Lifecycle: `load` once with complete data; `playAction` animates in, `stopAction` out;
`updateAction` is accepted any time after load, on air or off, and refused only before it;
every call answers a status code, never throws. Two fields are optional: `lapsCompletedByLeader`
(absent, no laps line) and `showFlagBand` (absent or true, the band; false, the card is head and
body only, 40 px lower; switched on air, the card grows or shrinks over `--motion-flag`).
The look comes from the theme alone (`packages/theme`): every colour, size, corner and duration
is a `var(--token)` of `ardosia/tokens.css` with no fallback, the motion from `readMotionTokens`,
the face Bebas Neue registered on the page by the theme's `fonts.css` (the graphic ships no font
and only awaits it through the theme's `waitForThemeFontsToBeReady`, `@bajaovrlay/theme/fonts`),
and the logo imported from `@bajaovrlay/theme/brand/`
so Vite bundles a copy into `dist/assets/`. `preview.html` imports the same theme files.
Preview: `pnpm --filter @bajaovrlay/race-clock dev`, then http://localhost:5175/preview.html
(add `?data=<url-encoded JSON>`). Unit tests: `pnpm --filter @bajaovrlay/race-clock test`;
Playwright on the built `dist/` under `/graphics/race-clock/`:
`pnpm --filter @bajaovrlay/race-clock test:e2e`, and after a deliberate visual change delete the
PNGs in `e2e/raceClockScreenshots.e2e.ts-snapshots/` and run it with `--update-snapshots`.
New graphic: copy this folder, rename package, manifest id, `main`, tag and dev ports, set `v_baja`
(layer, category, per-field form hints: ../README.md), take what graphics share from `../kit/`
(OGraf types, play steps, timeline playback, preview controls, manifest validator), replace
model, schema, styles, template; keep the tests' shape.
