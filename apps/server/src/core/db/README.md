# apps/server/src/core/db

The SQLite database (Drizzle on better-sqlite3). Start reading at `openDatabase.ts`:
it opens the file and applies the committed migrations at boot, failing closed.

- `tables.ts` — the two tables: `slices` (one JSON row per slice) and `event_log`.
- `commandOutcomeStorage.ts` — saves a command's slices and event-log row in one
  transaction.
- `sliceRowStorage.ts`, `eventLogRowStorage.ts` — reading and writing rows.
- `temporaryDatabase.testSupport.ts` — real SQLite files in temp folders, for tests.

Migrations live in `apps/server/drizzle/`. After changing `tables.ts`, run
`pnpm --filter @bajaovrlay/server db:generate` and commit what it writes.
