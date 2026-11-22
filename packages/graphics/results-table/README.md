# results-table (`@bajaovrlay/results-table`)

"Tabela de resultado" (BAJAOVRLAY-83): any result page of the Baja app on the fullscreen layer as
the site shows it, in the standings board's Ardósia look. It binds to the results table shape
(packages/shared, `resultsTableShape.ts`): the page's own columns (`columnHeads`), and per row the
site's rank ("–" when there is none, as during spoilers), the team and one text cell per column,
drawn as written ("SPOILERS", "SIM", "–"); a cell with two values ("55.6 / 54.9") shows the first.
Ranks 1 to 3 sit on the standings' green chip. 20 rows a page, turning every `--motion-board-hold`.
Each column is as wide as its widest text over every page, measured in the theme's font
(`resultsTableColumnWidths.ts`); the team takes the rest, and text cut off scrolls in its box.

The item's settings: "Colunas mostradas" (heads separated by commas; empty shows all), "Título"
(empty uses the page's name), "Ordenar por" and "Sentido" (`resultsTableSorting.ts`: numbers read
from "57.3", "102.5%", "6º", cells with no number last; the rank shown stays the site's).

Start at `results-table.ograf.json` and `src/resultsTable.ts` (the lifecycle, the standings' own),
then `resultsTablePageTurns.ts`, which draws a page: `resultsTableSorting`, `resultsTableText`,
`resultsTableLayout`, `resultsTableView`. Preview: `pnpm --filter @bajaovrlay/results-table dev`,
then http://localhost:5238/preview.html (`?data=<url-encoded JSON>`, `?stage=grey|black`). Tests:
`test` (unit) and `test:e2e` (Playwright on the built `dist/`: the fit test and the screenshots;
after a deliberate visual change rerun with `--update-snapshots`).
