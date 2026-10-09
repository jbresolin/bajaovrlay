# race-clock (`@bajaovrlay/race-clock`)

The race clock OGraf graphic: session name, running race time, leader laps and a flag band.
`race-clock.ograf.json` is what a renderer reads; its `main` points at the default export of
`src/race-clock.ts` (a Lit element), which only wires the pure modules beside it: the data
model (`raceClockModel.ts`), time (`clockExtrapolation.ts`, `clockFormatting.ts`), the frame
loop, the GSAP animations and the pt-BR catalog (`ptBR.ts`). Theme it with `--baja-*` CSS
custom properties (`raceClockStyles.ts`). Start reading at the manifest, then `race-clock.ts`.

Preview: `pnpm --filter race-clock dev`, then http://localhost:5175/preview.html (add
`?data=<url-encoded JSON>`). Unit tests: `pnpm --filter race-clock test`. Playwright on the
built `dist/` under `/graphics/race-clock/`: `pnpm --filter race-clock test:e2e`; refresh the
screenshots after a deliberate visual change: `pnpm --filter race-clock test:e2e --update-snapshots`.
New graphic: copy this folder, rename the package, manifest id, `main`, tag and dev ports,
then replace the model, styles and template; keep the tests' shape.
