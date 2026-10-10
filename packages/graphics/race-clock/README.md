# race-clock (`@bajaovrlay/race-clock`)

The race clock OGraf graphic: session name, running race time, leader laps and a flag band.
`race-clock.ograf.json` is what a renderer reads; its `main` points at the default export of
`src/race-clock.ts` (a Lit element), which only wires the pure modules beside it: data model,
time (`clockExtrapolation.ts`, `clockFormatting.ts`), frame loop, GSAP animations, `ptBR.ts`.
Lifecycle: `load` once with complete data; `playAction` animates in, `stopAction` out;
`updateAction` is accepted any time after load, on air or off, and refused only before it;
every call answers a status code, never throws. Theme via `--baja-*` CSS custom properties.
Preview: `pnpm --filter race-clock dev`, then http://localhost:5175/preview.html (add
`?data=<url-encoded JSON>`). Unit tests: `pnpm --filter race-clock test`; Playwright on the
built `dist/` under `/graphics/race-clock/`: `pnpm --filter race-clock test:e2e`, and after a
deliberate visual change `pnpm --filter race-clock test:e2e --update-snapshots`.
New graphic: copy this folder, rename the package, manifest id, `main`, tag and dev ports, set
`v_baja` (the default layer and category the server reads), then replace the model, styles
and template; keep the tests' shape. The server refuses data the manifest `schema` refuses.
