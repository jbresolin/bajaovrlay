# apps/server/src/core/db

The SQLite database (Drizzle on better-sqlite3). Start reading at `openDatabase.ts`:
it opens the file and applies the committed migrations at boot, failing closed.

- `tables.ts` — the five tables: `slices` (one JSON row per slice), `data_snapshots`
  (one row per source: its last good snapshot, BAJAOVRLAY-40), `event_log` (its
  `details` column, NULL in older rows, says where a take put its item; PR #44), and, for
  the operator login (BAJAOVRLAY-29), `server_secrets` (the key that signs session cookies)
  and `operator_sessions` (one row per open session, keyed by the SHA-256 of the cookie's id).
- `serverSecretRowStorage.ts`, `operatorSessionRowStorage.ts` — the login's rows.
- `commandOutcomeStorage.ts` — saves a command's slices, snapshot rows and event-log row
  in one transaction (or without the event-log row, for a routine poll).
- `bootRowStorage.ts` — what a boot writes, in one transaction (the legacy split included).
- `sliceRowStorage.ts`, `dataSnapshotRowStorage.ts`, `eventLogRowStorage.ts` — reading and
  writing rows.
- `databaseBackup.ts` — dated copies with SQLite's online backup while the server runs,
  the newest 14 kept; `src/backupDatabase.ts` is the command (BAJAOVRLAY-34).
- `temporaryDatabase.testSupport.ts` — real SQLite files in temp folders, for tests.

Migrations live in `apps/server/drizzle/`. After changing `tables.ts`, run
`pnpm --filter @bajaovrlay/server db:generate` and commit what it writes.
