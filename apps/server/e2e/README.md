# apps/server/e2e

Browser tests of the built system as the Docker image serves it (Playwright, Chromium).

- `servedOfflineFromTheBuild.e2e.ts` (BAJAOVRLAY-34) — every request to any address other
  than the server is refused inside the browser, as on the stream PC with no internet: the
  control page connects, and `/render/` draws a race clock taken over the WebSocket (the
  control page's helper, `apps/control/e2e/eventInboxOnTheRealServer.ts`) in Bebas Neue,
  with nothing fetched from elsewhere, no failed request and no error answer.
- `builtServer.ts` — the port (5186, plus `BAJAOVRLAY_E2E_PORT_OFFSET`) and the throwaway
  data folder `apps/server/.e2e-data/`. `../playwright.config.ts` starts `node dist/main.js`,
  so run `pnpm build` first, then `pnpm --filter @bajaovrlay/server test:e2e`.
