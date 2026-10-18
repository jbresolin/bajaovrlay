# @bajaovrlay/server

The Node server that owns all BajaOvrLay state (Hono on Node 22). It keeps the state
slices in SQLite, changes them only through commands, pushes every change over the
WebSocket at `/ws`, answers `GET /api/v1/state` and `GET /health`, and serves the built
control page (`/`), renderer (`/render/`) and graphic packages (`/graphics/`).

Start reading at `src/main.ts` (environment and paths), then
`src/core/boot/startServer.ts` (the boot steps), then
`src/core/store/createStateStore.ts` (the single command path).

- `src/core/` — the server's building blocks, one folder per concept (see its README).
- `src/api/v1/` — thin REST routes and the generated OpenAPI document.
- `drizzle/` — committed SQL migrations, applied at boot.
- `src/modules/` — feature modules; the first is `dataSources/` (BAJAOVRLAY-17).

Run it with `pnpm dev` from the repository root, or `pnpm build` then `pnpm start`.
Settings come from environment variables documented in `/.env.example`.
