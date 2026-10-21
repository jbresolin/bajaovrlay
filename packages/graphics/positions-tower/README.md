# positions-tower (`@bajaovrlay/positions-tower`)

The positions tower OGraf graphic in Ardósia: the race order as slate pills under the clock,
on the right-hand column, compact (position, car chip, team, laps) or detailed (the school
after the team, the gaps without a unit, the lap times, the stops, the status icons), paging
through the field and sliding the cars that change place (FLIP, the ▲ / ▼ cue). Start at
`positions-tower.ograf.json` (what a renderer and the control page read) and `src/positions-tower.ts`
(the OGraf lifecycle, which only wires the modules beside it: `positionsTowerModel` for the data
and settings, `towerStage` for the page on air and its rows (on `positionsTowerView` and
`towerRows`, the DOM changed in place), `towerPages`,
`pageTurner`, `positionsTowerAnimations` from `readMotionTokens`, `towerText` from
`@bajaovrlay/shared/raceTimeText`, `statusIcons`, `ptBR` for every word). Fields: `entries`
(the canonical positions list, bound live to a source), `layout`, the seven column switches of
the detailed layout and `paging`. The page timer is local to the graphic: the program page and
the preview page each hold and turn their own pages, nothing in the server's state says which
page is on air (decision 15 of BAJAOVRLAY-22). One row node per visible car, keyed by car number,
reused across updates; the look comes from the theme alone (`packages/theme`). Preview:
`pnpm --filter @bajaovrlay/positions-tower dev`, then http://localhost:5177/preview.html (add
`?data=<url-encoded JSON>`). Unit tests: `pnpm --filter @bajaovrlay/positions-tower test`; Playwright on
the built `dist/` under `/graphics/positions-tower/`: `pnpm --filter @bajaovrlay/positions-tower test:e2e`,
and after a deliberate visual change delete the PNGs in `e2e/positionsTowerScreenshots.e2e.ts-snapshots/`
and run it with `--update-snapshots`.
