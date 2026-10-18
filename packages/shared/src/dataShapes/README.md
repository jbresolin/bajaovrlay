# packages/shared/src/dataShapes

The canonical data shapes: what session, positions, standings and brackets look like
inside BajaOvrLay. Every data source (the simulator, a replay, later the Baja app or a
spreadsheet) maps its data into these, and graphics bind only to them. Start reading at
`positionsShape.ts`, the richest one; `sessionShape.ts` reuses the race clock's flag values
and clock field names so a binding feeds the clock with no transform.

Conventions: times are integer milliseconds (durations like `lastLapMs`, moments like
`updatedAtMs` in ms since 1970 on the server's clock); every entry repeats `carNumber`,
`teamName` and `schoolName`; an optional field means "the source does not know", never a
placeholder. **`bracketsShape.ts` is a draft** until BAJAOVRLAY-25 checks it against the
Baja app's `tournament` table.

`validateDataShape.ts` checks a payload for one shape (pt-BR error naming the path);
`bindablePaths.ts` hand-lists the paths a binding may point at; `ptBRDataShapes.ts` holds
this folder's pt-BR texts. `samples/` holds realistic payloads, also used as test fixtures.
`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
