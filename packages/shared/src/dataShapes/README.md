# packages/shared/src/dataShapes

The canonical data shapes: what session, positions, standings and brackets look like inside
BajaOvrLay. Every data source maps its data into these, and graphics bind only to them. Start
at `positionsShape.ts`, the richest one; `sessionShape.ts` reuses the race clock's flag values
and clock field names (`clockMode`…) so a binding feeds the clock with no transform.

Conventions: times are integer milliseconds (durations like `lastLapMs`, moments like
`updatedAtMs` on the server's clock); every entry repeats `carNumber`, `teamName` and
`schoolName`; optional means "the source does not know", never a placeholder.
**`bracketsShape.ts` is a draft** until BAJAOVRLAY-25 checks it against the Baja app.

`validateDataShape.ts` checks a payload (pt-BR error naming the path); `bindablePaths.ts`
hand-lists the paths a binding may point at; `ptBRDataShapes.ts` holds the pt-BR texts;
`samples/` holds realistic payloads, also the test fixtures. `index.ts` lists every export.
