# apps/server/src/core

The server's building blocks, one folder per concept. Feature modules build on these.

- `http/` — `createServerApp` (start here), the `/health` route, request ids and
  request logging, JSON error answers, serving the built pages, and built graphic
  packages at `/graphics/<package>/` (`graphicPackages.ts`, which refuses traversal).
- `logger/` — the structured JSON logger (pino). Never use `console` on the server.
- `env/` — reads and validates environment variables; a bad value stops the boot.
- `messages/` — the pt-BR catalog for every message a person reads.
- `boot/` — `startServer`: database, store, server actors, HTTP and WebSocket on one port.
- `store/` — the state slices and `applyCommand`, the single path that changes them.
- `db/` — the SQLite file (Drizzle), its migrations and the one-transaction save.
- `events/` — the event log and the 200-entry `eventLog` slice.
- `ws/` — the WebSocket hub at `/ws`.
