# @bajaovrlay/server

The Node server that owns all BajaOvrLay state (Hono on Node 22). It keeps the state
slices in SQLite, changes them only through commands, pushes every change over `/ws`,
polls the data sources that are on, answers the REST API under `/api/v1`, and serves
the built control page (`/`), renderer (`/render/`), graphics (`/graphics/`) and the
on-air theme (`/theme/`, from packages/theme).

Start reading at `src/main.ts` (it also points the boot at the `build-id.json` that
`pnpm build` leaves once every package has built, `src/readBuildId.ts`, read once at boot
and named in every hello so open pages reload after an upgrade; a rebuild takes effect at
the restart), then `src/core/boot/startServer.ts` (the boot steps),
then `src/core/store/createStateStore.ts` (the single command path).

- `src/core/` — the server's building blocks, one folder per concept (see its README).
- `src/modules/` — feature modules: `dataSources/` (polled sources, recordings), `bindings/`
  (live refresh of bound fields, the operator's corrections), and `outputs/` (outputs and
  the editing of layers, BAJAOVRLAY-49) and `backup/` (the zip "Cópia de segurança"
  downloads, BAJAOVRLAY-33), among others; each has a README.
- `src/api/v1/` — thin REST routes and the generated OpenAPI document.
- `src/backupDatabase.ts` — the backup command, `node apps/server/dist/backupDatabase.js
<folder>`: a dated copy of the database while the server runs, the newest 14 kept.
- `e2e/` — the built server with the network blocked (Playwright, after `pnpm build`).
- `drizzle/` — committed SQL migrations, applied at boot.
- `/.env.example` — every setting. Run the server with `pnpm dev` from the repo root.
- `/Dockerfile` and `/deploy/` — the one image of the whole system, and how it runs on
  TrueNAS and on the stream PC.
