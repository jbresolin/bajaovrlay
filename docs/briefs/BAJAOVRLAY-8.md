# Agent brief — BAJAOVRLAY-8: server core (state slices, commands, WS protocol, SQLite persistence, event log)

**Branch:** `BAJAOVRLAY-8-server-core` off `main` (after BAJAOVRLAY-7 is merged;
independent of BAJAOVRLAY-10). One PR, left open for João's review. Do not merge.

**Design authority:** `CLAUDE.md` (architecture rules 1–2 especially). This is the
"replicant" module: the server owns all state; clients send commands and receive slices.

## Deliverable

`apps/server/src/core/store/`, `core/ws/`, `core/db/`, plus the shared schemas in
`packages/shared`.

**Slices (Zod in `packages/shared/src/slices/`)** — for M0 only these:

- `layers`: `{ id, name, zIndex, replacePolicy: 'out-then-in' | 'cut' | 'crossfade', persistent }`
- `graphics`: `{ id, manifest, defaultLayerId, category, thumbnailUrl, defaultFields }`
- `instances`: `{ id, layerId, graphicId, target: 'program' | 'preview', resolvedData, currentStep, status: 'loading' | 'ready' | 'on-air' | 'stopping', takenAt }`
- `eventLog`: `{ ts, actor, command, payload, result }` (append-only)

Other slices (rundowns, items, dataSources, overrides, entities, theme, macros) arrive
in M1/M2 — do not create them now.

**Commands (Zod in `packages/shared/src/commands/`)** — for M0 only:
`takeGraphic` (graphicId, layerId, data), `clearLayer` (layerId), `clearAll`.
(`takeItem` and the rundown arrive in M1; for M0 the control page sends the resolved data
directly.) Every command has an input schema; `Command` is a discriminated union on `type`.

**Store** (`core/store/`): in-memory slices; `applyCommand(command, actor)` is the single
code path: validate → authorize (a no-op hook for now, named and tested) → apply (pure
reducer per command, one file each) → persist → append to event log → broadcast changed
slices. Reducers are pure functions that take the slice and return a new one; no I/O in
reducers.

**Persistence** (`core/db/`): Drizzle + better-sqlite3. Tables: `slices` (name, json,
updatedAt — one row per slice) and `event_log` (id, ts, actor, command, payload,
result). Migrations via drizzle-kit, run at boot, fail closed if a migration fails. On
boot the store hydrates from `slices`; `instances` is hydrated too so a server restart
restores what was on air.

**WS protocol** (`packages/shared/src/ws/` + `core/ws/`): messages `hello` (server →
client: all slices), `slice` (server → client: one slice), `command` (client → server),
`commandResult` (server → client: ok, or an error with a pt-BR message). JSON,
Zod-validated both directions; an invalid message is answered with an error and logged,
never crashes the socket. Server pings every 15 s and drops dead sockets.

**Seed data:** on first boot with an empty DB, insert the fixed layer list (`bug`,
`ticker`, `clock`, `lower-third`, `fullscreen`, in that z-order) and register the
`race-clock` graphic by reading `packages/graphics/race-clock/dist/race-clock.ograf.json`
if present (skip with a logged warning if not — BAJAOVRLAY-10 may land after this).

**HTTP:** `GET /api/v1/state` returns all slices (used by the renderer on reconnect);
`/graphics/*` serves built graphic packages statically.

## Tests (write first)

- Reducers, table-driven: take on an empty layer; take replacing an existing instance on
  the same layer; take on a non-existent layer is refused; clearLayer; clearAll; takes on
  two layers leave each other alone.
- applyCommand: an invalid payload is rejected with the field named; a successful command
  appears in the event log with actor and timestamp; a failed command appears in the
  event log as failed.
- Persistence (real SQLite file in a temp dir): write slices, create a fresh store from
  the same file, slices identical; event log ordering; a migration failure at boot
  aborts startup.
- WS (real server on a random port): a client gets `hello` with all slices on connect; a
  command from one client produces a `slice` message on another client; a malformed
  message gets an error and the socket stays open.

## Done when

Root CI passes; `pnpm dev` boots the server and `/api/v1/state` shows the seeded layers;
PR description documents the WS message shapes with one example each.
