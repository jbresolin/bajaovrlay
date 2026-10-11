# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Start reading at
`takeAndClear.e2e.ts`: it is M0's definition of done, walked in a real browser.

- `takeAndClear.e2e.ts` — fill the race clock form, "Colocar no ar", reload, "Limpar".
- `rundownTakeWithSpace.e2e.ts` — make two clock items, Space takes the first, reload;
  it empties the rundown and the clock layer before and after, for the other file's sake.

Nothing is faked here: `../playwright.config.ts` starts the real server from source on
port 5187 with a new SQLite file in the gitignored `../e2e-data/`, and the control page's
dev server on 5188. A `pnpm dev` left running on 3000 and 5173 is not used or disturbed.

Run with `pnpm --filter @bajaovrlay/control test:e2e`, after `pnpm build` once: the
server only registers built graphics, so without the build the take is refused.
