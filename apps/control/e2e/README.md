# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Start reading at the two files, in order:

- `takeAndClear.e2e.ts` — the operator's whole path in a real browser, with a second page at
  `/render/` standing in for OBS: "Colocar no ar" (the layer says "No ar" within 3 s), "Atualizar"
  (the clock in the monitor stays the same element), reload, "Limpar". Then the same take with no
  OBS: the layer stays "Carregando" until the stand-in is opened, because the program monitor
  (`/render/?monitor=1`) draws the clock but never reports it.
- `rundownTakeWithSpace.e2e.ts` — Space from a focused button, clock from the take, Left arrow, reload.

Nothing is faked: `../playwright.config.ts` starts the real server from source (port 5187, a new
SQLite file in the gitignored `../e2e-data/`) and the control dev server (5188); a running `pnpm dev`
is not disturbed. A `[vite] ws proxy error: write EPIPE` line as a page closes is harmless noise.
Run `pnpm --filter @bajaovrlay/control test:e2e` after one `pnpm build` (built graphics, renderer).
