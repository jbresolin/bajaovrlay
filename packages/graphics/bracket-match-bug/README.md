# bracket-match-bug (`@bajaovrlay/bracket-match-bug`)

The match bug (BAJAOVRLAY-65): the Super Prime's match "agora", small and meant to stay on air,
on its own seeded layer "Partida da chave" (`bracket-match`). The round over "47 CORISCO 1 × 2
PEQUI 12": the score and "MD3" only for a best of N above 1, each car's time in a timed run, and
the winner's chip and result in green once decided, the loser dimmed. In the corner the item picks
(the kit's `screenCornerPosition`); top-left, the default, stands beside the sponsor bug. Each short
name has a box of the theme's `--match-bug-name-width`; a longer one scrolls in it. Every field is
optional: an empty "agora" draws nothing, and an update that takes the match off the air leaves the
bug on air showing nothing, never a stale match.
Start reading at `src/bracket-match-bug.ts` (the team card's lifecycle); it wires
`matchBugModel.ts` (data and what it shows), `matchBugView.ts`, `matchBugStyles.ts`,
`matchBugAnimations.ts` (the logo bug's fade), the kit's `matchTimeText` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/bracket-match-bug dev`, then http://localhost:5226/preview.html
(add `?match=before|during|after|times|third-place|empty`, `?corner=…`, `?stage=grey|black` or
`?data=<JSON>`). Unit tests: `pnpm --filter @bajaovrlay/bracket-match-bug test`; Playwright with
the screenshots: `pnpm --filter @bajaovrlay/bracket-match-bug test:e2e`.

## The seeded item "Partida agora"

Seeded once per database in the quick-fire panel "Chave", on the layer "Partida da chave", every
match field bound live to "Chaves › Partida agora" of the seeded simulator. On the day, point the
bindings at the real tournament source (the Baja app preset "Chave") and choose "agora" on the
console's "Partidas da chave".
