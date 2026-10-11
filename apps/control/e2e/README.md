# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Start reading at the one file:

- `takeAndClear.e2e.ts` — the operator's whole path in a real browser: fill the race clock
  form, "Colocar no ar" (the layer says "No ar" within 3 s, once the monitor reports), change
  the flag with "Atualizar" (the clock in the monitor stays the same element), reload, "Limpar".

Nothing is faked: `../playwright.config.ts` starts the real server from source (port 5187,
a new SQLite file in the gitignored `../e2e-data/`) and the control dev server (5188); a
running `pnpm dev` is not disturbed. A `[vite] ws proxy error: write EPIPE` line, seen now
and then (here and in the renderer's run) as a page closes, is harmless teardown noise.

Run `pnpm --filter @bajaovrlay/control test:e2e` after one `pnpm build`: the server only
registers built graphics and the program monitor frames the built renderer.
