# sponsor-roll-plain (`@bajaovrlay/sponsor-roll-plain`)

The plain sponsor roll (BAJAOVRLAY-64): every sponsor once, one at a time, its logo under its
level's heading on the theme's card (the sponsor bug's width), in the corner the item picks (the
kit's `screenCornerPosition`), top-left on its own layer, just above the sponsor bug's, by default; a sponsor with no logo is
skipped. The order and each level's hold are shared's one table (`@bajaovrlay/shared/sponsorRollPass`):
the server's auto-out reads the same table (the manifest's `v_baja.autoOutRule`), so the layer is
free when the last hold ends; the graphic never loops. The seeded trigger "Patrocinadores a cada
30 min" brings it back (off and asking until switched on; docs/triggers.md).
Start reading at `src/sponsor-roll-plain.ts` (the lifecycle and the turns), then
`sponsorRollPlainModel.ts`, `sponsorRollPlainView.ts`, `sponsorRollPlainAnimations.ts`.
Preview: `pnpm --filter @bajaovrlay/sponsor-roll-plain dev`, http://localhost:5230/preview.html
(`?sponsor=Bosch`, `?corner=bottom-right`, `?stage=grey|black`, `?data=<JSON>`). Tests: `test`
(unit) and `test:e2e` (the built `dist/` and the screenshots) on `--filter @bajaovrlay/sponsor-roll-plain`.
