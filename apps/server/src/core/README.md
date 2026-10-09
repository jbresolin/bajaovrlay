# apps/server/src/core

The server's building blocks, one folder per concept. Feature modules build on these.

- `http/` — `createServerApp` (start here), the `/health` route, request ids and
  request logging, JSON error answers, serving the built pages.
- `logger/` — the structured JSON logger (pino). Never use `console` on the server.
- `env/` — reads and validates environment variables; a bad value stops the boot.
- `messages/` — the pt-BR catalog for every message a person reads.

Coming in BAJAOVRLAY-8: `store/` (state slices and commands), `db/` (SQLite), `ws/`
(WebSocket protocol), `events/` (event log).
