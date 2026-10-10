# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Start reading at
`takeAndClear.e2e.ts`: the operator's whole path, walked in a real browser.

- `takeAndClear.e2e.ts` — fill the race clock form, "Colocar no ar" (the layer says
  "No ar" within a second), change the flag with "Atualizar" (the clock in the program
  monitor stays the same element), reload, "Limpar".

Nothing is faked here: `../playwright.config.ts` starts the real server from source on
port 5187 with a new SQLite file in the gitignored `../e2e-data/`, and the control page's
dev server on 5188. A `pnpm dev` left running on 3000 and 5173 is not used or disturbed.

Run with `pnpm --filter @bajaovrlay/control test:e2e`, after `pnpm build` once: the
server only registers built graphics and the program monitor frames the built renderer.
