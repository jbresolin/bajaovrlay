# apps/server/src/core/db

The SQLite database (Drizzle on better-sqlite3). Start reading at `openDatabase.ts`:
it opens the file and applies the committed migrations at boot, failing closed.

- `tables.ts` — the three tables: `slices` (one JSON row per slice), `data_snapshots`
  (one row per source: its last good snapshot, BAJAOVRLAY-40) and `event_log`.
- `commandOutcomeStorage.ts` — saves a command's slices, snapshot rows and event-log row
  in one transaction (or without the event-log row, for a routine poll).
- `bootRowStorage.ts` — what a boot writes, in one transaction (the legacy split included).
- `sliceRowStorage.ts`, `dataSnapshotRowStorage.ts`, `eventLogRowStorage.ts` — reading and
  writing rows.
- `temporaryDatabase.testSupport.ts` — real SQLite files in temp folders, for tests.

Migrations live in `apps/server/drizzle/`. After changing `tables.ts`, run
`pnpm --filter @bajaovrlay/server db:generate` and commit what it writes.
