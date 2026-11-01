# standings (`@bajaovrlay/standings`)

The standings OGraf graphic in Ardósia, on the fullscreen layer. The board is chosen from the data,
never by a switch: with `scoreParts` the overall table (one muted column per part, the total in
green, 20 rows a page turning every `--motion-board-hold`, the head's line "2/3 · 21º A 40º"); without
them the whole field in three columns of 20 tower pills (paging by 60 past 60 teams). Disqualified
teams close the list, dimmed, "—" and "DESCL."; rank 1, tied or not, is on the green chip.
A team and school too long for the column, and a long event line, scroll inside their box on one
cycle for the board (the kit's `scrollingTextWhenTooLong`, BAJAOVRLAY-55); a redraw keeps a row's
team box when its team is unchanged, so a live update never restarts its scroll.

Start at `standings.ograf.json` and `src/standings.ts` (the OGraf lifecycle and the motion; it
wires `standingsModel`, `standingsPageTurns` (the page shown and a turn), `standingsLayout`,
`standingsView`, `standingsText`, `standingsAnimations`, `ptBR` and the kit's `pageTurner`,
`pageHold` and `pageCycle`). A live update on air redraws the current page in place (same rows, no re-entry); a
team that changes place or page is simply drawn where it now is: re-ranking is not animated in this
task (BAJAOVRLAY-24).

Preview: `pnpm --filter @bajaovrlay/standings dev`, then http://localhost:5194/preview.html
(`?data=<url-encoded JSON>`, `?stage=grey|black`). Tests: `test` (unit) and `test:e2e` (Playwright on
the built `dist/`; after a deliberate visual change delete the PNGs in `e2e/*-snapshots/` and rerun
with `--update-snapshots`).
