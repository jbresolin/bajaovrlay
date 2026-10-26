# packages/shared/src/dataShapes

The canonical data shapes: what session, positions, standings, brackets and incidents
(penalties and warnings, which the event inbox watches) look like inside BajaOvrLay. Every data source maps its data into these, and graphics bind only to them. Start
at `positionsShape.ts`, the richest one; `sessionShape.ts` reuses the race clock's flag values
and clock field names (`clockMode`…) so a binding feeds the clock with no transform.

Conventions: times are integer milliseconds (durations like `lastLapMs`, moments like
`updatedAtMs` on the server's clock); every entry repeats `carNumber`, `teamName` and
`schoolName`; optional means "the source does not know", never a placeholder. Positions take
what a source gives (gate 2 of PR #16). Brackets (`bracketsShape.ts`, BAJAOVRLAY-25) carry
best of N (`bestOf`, `wins`), W.O. (`walkover`), byes (no `carB`) and one third-place round,
checked by `bracketMatchRules.ts` and `bracketRoundsRules.ts` (a round is listed whole);
`samples/brackets.super-prime.json` is the real Super Prime of the 30ª Competição.
Standings carry the score's parts as the source names them (`scoreParts`, `pointsByPart`) and
keep disqualified teams, unranked, at the end (`isDisqualified`, BAJAOVRLAY-24).

`validateDataShape.ts` checks a payload (pt-BR error naming the path); `bindablePaths.ts`
hand-lists the paths a binding may point at, each with its value type (standings by row,
"1ª linha", since tied teams share a rank; a positions car chosen by its number under
`entryOfCar.`; the whole session clock as `clock`, the clock group; each shape's list is built
once and kept, frozen, since every resolution looks a path up in it, BAJAOVRLAY-45);
`ptBRDataShapes.ts` holds the pt-BR texts;
`samples/` holds realistic payloads, also the test fixtures. `index.ts` lists every export.
