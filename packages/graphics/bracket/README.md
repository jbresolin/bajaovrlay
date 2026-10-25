# bracket (`@bajaovrlay/bracket`)

The elimination bracket OGraf graphic in Ardósia (design: PR #21, catalogue entry 4), on the
`fullscreen` layer: the kit's wide head ("SUPER PRIME", the round of a board, "3/7"), then the
step on screen. A round of more than four matches is a **round board**, two columns of 40 px
match cards (32 a page, one step a page); the rounds from the quarter-finals down are the
**tree**, a column per round under its name pill, each match centred between the two it comes
from, the lines between them, the third place at the foot of the final's column. A match's
result is a time, a count of wins (best of N), the winner's mark, or the outlined "W.O."; a
bye's empty side is the dashed "SEM ADVERSÁRIO". Start reading at `src/bracket.ts` (the OGraf
lifecycle); it wires `bracketModel.ts` (Zod data), `bracketStepView.ts` (what a step shows, on
the shared plan `@bajaovrlay/shared/bracketSteps` the server counts with), `matchResults.ts`,
`treeLayout.ts` (pure geometry), `bracketView.ts` with `roundBoardView.ts`,
`bracketTreeView.ts` and `bracketCarView.ts`, the three style files, `bracketStepMoves.ts`
and `bracketLiveUpdates.ts` (what an update changed on screen) on `bracketAnimations.ts`, and
`ptBR.ts`. It has no timer: nothing on it moves by itself.

**Steps** (`stepCount` -1, `v_baja.stepCounter` `bracketSteps`): counted from the rounds, one per
board page, one per tree round, one for the third place (just before the final's). The real
Super Prime is 7: three boards (32 avos, 16 avos, oitavas), quartas, semis, 3º lugar, final.
A live update that shrinks the rounds brings the step back to the last, as the server does.

Preview: `pnpm --filter @bajaovrlay/bracket dev`, then http://localhost:5220/preview.html (add
`?results=board`, `?results=tree`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/bracket test`; Playwright on the built `dist/`, with the 18 screenshots:
`pnpm --filter @bajaovrlay/bracket test:e2e` (add `--update-snapshots` after a deliberate visual change).

## A typical item: the Super Prime

| Field (form label) | Value in the item editor                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Fases              | Fonte › (the Baja app, or Simulador — Enduro) › Chaves › Todas as fases, Ao vivo |
| Título             | SUPER PRIME                                                                      |

Live, so a result arriving reaches the air by itself (its cells crossfade); the steps follow the
rounds the source lists. The simulator's Super Prime (seed 2027 with ten cars at 60× is over in
17 s) rehearses it.
