# apps/renderer/e2e

Browser tests of the renderer page (Playwright, Chromium). Start at `lifecycle.e2e.ts`.

- `lifecycle`, `replaceWithCut`, `brokenGraphic`, `instanceStatus`, `retryAfterFailedImport`,
  `programMonitor`, `previewPage` (`/render/?target=preview`: the screen after the take, with a second page for `/render/` when both must be compared), `stage` — a stand-in server inside the page
  (`fakeServerForPage.ts`) and the graphic in `../test-fixtures/fake-graphic`, whose calls `fakeGraphicCalls.ts` reads back.
- `lateHelloStateRead` — a silent stand-in socket, so each page falls back to
  `/api/v1/state` and must name its own role there.
- `themeOnRoot` — the theme (packages/theme, from the real server at `/theme/` through the
  dev server's proxy) is on :root and its face registered before the first graphic loads;
  the fake graphic notes the token it saw at `load` (`themeTokenAtLoad`). Its last test
  routes the tokens file to a 404 inside the page: the renderer logs "theme not loaded on
  :root" and still builds its layers (nothing is blanked).
- `raceClockOnAir.e2e.ts` — the one file that drives the REAL server's state (`realServer.ts`,
  port 5185) and the built race clock; it holds the screenshot baseline. `themeOnRoot` reads
  the real server's `/theme/` files too, through the proxy, but sends it no command.

**Watch (2026-10-11, BAJAOVRLAY-13):** a test named "counts on its own while the clock is
running" failed once in a full local run right after `main` was merged, and its error text
was lost. That test is in the race clock's own `raceClockOnAir.e2e.ts`
(`packages/graphics/race-clock/e2e/`), not this folder's file of the same name. It has passed
in every run since. If it fails again, keep the output and open a ticket; do not re-run to green.
