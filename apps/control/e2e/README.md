# apps/control/e2e

Browser tests of the control page (Playwright, Chromium), on forms generated from the race
clock's manifest (labels are its titles). Start reading at the first two files:

- `takeAndClear.e2e.ts` — "Edição rápida" with a page at `/render/` standing in for OBS: "Colocar
  no ar" ("No ar" within 3 s), "Atualizar" (same element), reload, "Limpar". Then with no OBS: the
  layer stays "Carregando", because the monitor (`/render/?monitor=1`) never reports.
- `itemUpdateOnAir.e2e.ts` — an item made in the item editor, fired, then changed with "Atualizar
  no ar": same element in the OBS stand-in, and the item is saved.
- `rundownTakeWithSpace.e2e.ts` — Space, clock from the take, Left arrow, reload, "Excluir".
- `emptyTheServerState.ts` — called before each test; `emptyServerState.e2e.ts` proves it.

`../playwright.config.ts` starts the real server (port 5187, new SQLite file in `../e2e-data/`) and
the control dev server (5188). Run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`.
