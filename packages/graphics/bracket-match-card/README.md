# bracket-match-card (`@bajaovrlay/bracket-match-card`)

The "a seguir" card (BAJAOVRLAY-65): the Super Prime's next match, larger than the match bug, on
the `lower-third` layer at the lower third's widest (`--lower-third-max-width`, so it keeps its size
from match to match). "A SEGUIR · SEMIFINAL" with "MD3" at the right for a best of N, then each
side: the team's logo (the kit's logo cell, on the light plate when the team chose it) or, without
one, its large car-number chip; the team's name over its school, city and state. Between them "×",
and the score once the match has started. A name or a details line too long for its side scrolls
inside it. Every field is optional: an empty "a seguir" draws nothing.
Start reading at `src/bracket-match-card.ts` (the team card's lifecycle); it wires
`matchCardModel.ts` (data and what it shows), `matchCardView.ts`, `matchCardStyles.ts`,
`matchCardAnimations.ts` (the team card's rise), the kit's `waitForImagesToSettle` and
`matchTimeText`, and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/bracket-match-card dev`, then
http://localhost:5228/preview.html (add `?match=logos|no-logos|one-logo|started|longest-names|empty`,
`?stage=grey|black` or `?data=<JSON>`; the two logos are the design's sample files of Corisco Baja
and Equipe Cactus Baja). Unit tests: `pnpm --filter @bajaovrlay/bracket-match-card test`;
Playwright with the screenshots: `pnpm --filter @bajaovrlay/bracket-match-card test:e2e`.

## The seeded item "Partida a seguir"

Seeded once per database in the quick-fire panel "Chave", on the lower third, every field bound
live to "Chaves › Partida a seguir" of the seeded simulator: the team's name, city, state and logo
come from Cadastros, joined by car number; a team not in Cadastros shows the bracket's short name
and its car number.
