# apps/server/src/core

The server's building blocks, one folder per concept. Feature modules build on these.

- `http/` — `createServerApp` (start here), the `/health` route, request ids and
  request logging, JSON error answers, serving the built pages, built graphic
  packages at `/graphics/<package>/` (`graphicPackages.ts`, which refuses traversal) and
  the theme at `/theme/` (`themeFiles.ts`: the ardosia/, fonts/ and brand/ folders of
  packages/theme only; the tokens never cached, the font file and the logo for a year).
- `apiAccess/` — the tokens of the command API (BAJAOVRLAY_API_TOKENS) and the middleware
  that checks a request's Bearer token in front of each of its routes.
- `operatorLogin/` — the operator login (BAJAOVRLAY-29): the two PINs, the session cookie,
  the lockout, and the access table of every /api/v1 route.
- `logger/` — the structured JSON logger (pino). Never use `console` on the server.
- `env/` — reads and validates environment variables; a bad value stops the boot.
- `messages/` — the pt-BR catalog for every message a person reads.
- `boot/` — `startServer`: database, store, server actors, HTTP and WebSocket on one port.
- `store/` — the state slices and `applyCommand`, the single path that changes them.
- `db/` — the SQLite file (Drizzle), its migrations and the one-transaction save.
- `events/` — the event log and the 200-entry `eventLog` slice.
- `ws/` — the WebSocket hub at `/ws`.
- `time/` — the server clock: monotonic time, never moved by a step of the wall clock.
