# apps/server/src/core/events

The event log: one entry per command, ok or failed, appended by the store's
`applyCommand` and never edited. Start reading at `eventLogSlice.ts`.

- `eventLogSlice.ts` — the `eventLog` slice keeps only the newest 200 entries
  (`eventLogSliceSize`), because it is broadcast after every command.
- `eventLogRowConversion.ts` — turns a database row back into a slice entry.

The full log lives in the `event_log` table (see `../db/`), which keeps every entry.
