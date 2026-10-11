# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Start reading at the first two files:

- `takeAndClear.e2e.ts` — the operator's path with a second page at `/render/` standing in for
  OBS: "Colocar no ar" (the layer says "No ar" within 3 s), "Atualizar" (same element in the
  monitor), reload, "Limpar". Then the same take with no OBS: the layer stays "Carregando",
  because the program monitor (`/render/?monitor=1`) draws the clock but never reports it.
- `rundownTakeWithSpace.e2e.ts` — Space from a focused button, clock from the take, Left arrow,
  reload, two-press "Excluir".
- `emptyTheServerState.ts` — every file calls it before each test (nothing on air, no items), so
  tests pass in any order; `emptyServerState.e2e.ts` proves it.

Nothing is faked: `../playwright.config.ts` starts the real server from source (port 5187, a new
SQLite file in the gitignored `../e2e-data/`) and the control dev server (5188). A `[vite] ws proxy
error: write EPIPE` line is harmless noise. Run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`.
