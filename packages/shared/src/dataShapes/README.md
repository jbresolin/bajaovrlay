# packages/shared/src/dataShapes

The canonical data shapes: what session, positions, standings and brackets look like inside
BajaOvrLay. Every data source maps its data into these, and graphics bind only to them. Start
at `positionsShape.ts`, the richest one; `sessionShape.ts` reuses the race clock's flag values
and clock field names (`clockMode`…) so a binding feeds the clock with no transform.

Conventions: times are integer milliseconds (durations like `lastLapMs`, moments like
`updatedAtMs` on the server's clock); every entry repeats `carNumber`, `teamName` and
`schoolName`; optional means "the source does not know", never a placeholder. Positions take
what a source gives (gate 2 of PR #16). **`bracketsShape.ts` is a draft** until BAJAOVRLAY-25.

`validateDataShape.ts` checks a payload (pt-BR error naming the path); `bindablePaths.ts`
hand-lists the paths a binding may point at, each with its value type (standings by row,
"1ª linha", since tied teams share a rank; a positions car chosen by its number under
`entryOfCar.`; the whole session clock as `clock`, the clock group);
`ptBRDataShapes.ts` holds the pt-BR texts;
`samples/` holds realistic payloads, also the test fixtures. `index.ts` lists every export.
