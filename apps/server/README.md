# @bajaovrlay/server

The Node server that owns all BajaOvrLay state (Hono on Node 22). Today it answers
`GET /health`, logs structured JSON with a `request_id` per request, and serves the
built control page at `/` and the built renderer at `/render/` when they exist.

Start reading at `src/main.ts` (boot: environment, logger, listen), then
`src/core/http/createServerApp.ts` (the app itself, built without listening so tests
can call `app.request()`).

- `src/core/` — the server's building blocks, one folder per concept (see its README).
- `src/modules/` and `src/api/v1/` — feature modules and their REST routes (from M1).

Run it with `pnpm dev` from the repository root, or `pnpm build` then `pnpm start`.
Settings come from environment variables documented in `/.env.example`.
