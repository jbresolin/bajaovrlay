# positions-tower (`@bajaovrlay/positions-tower`)

The positions tower OGraf graphic in Ardósia: the race order as slate pills under the clock,
compact or detailed, paging through the field (20 rows per page, the timer local to the graphic:
decision 15 of BAJAOVRLAY-22) and sliding the cars that change place (FLIP, ▲ / ▼). One row node
per visible car, reused across updates; the look comes from the theme alone (`packages/theme`).

Start at `positions-tower.ograf.json` (what a renderer and the control page read) and
`src/positions-tower.ts` (the OGraf lifecycle; it wires `positionsTowerModel`, `towerStage` on
`positionsTowerView` and `towerRows`, `towerPageTurns` (a turn and what arrived during it),
`towerPages`, the kit's `pageTurner`, `positionsTowerAnimations`, `towerLayoutTokens`, `towerText`, `ptBR`).

Preview: `pnpm --filter @bajaovrlay/positions-tower dev`, then http://localhost:5177/preview.html
(add `?data=<url-encoded JSON>`). Tests: `test` (unit) and `test:e2e` (Playwright on the built
`dist/`; after a deliberate visual change delete the PNGs in `e2e/*-snapshots/`, rerun with `--update-snapshots`).
