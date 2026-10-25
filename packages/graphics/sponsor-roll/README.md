# sponsor-roll (`@bajaovrlay/sponsor-roll`)

The sponsor roll OGraf graphic in Ardósia (BAJAOVRLAY-46; design: the `sponsor-roll` and
`sponsor-roll-canto` pages of PR #21): every sponsor from Cadastros, the round in the kit's order
(Diamante … "Realização" last). Layout `fullscreen`, on the fullscreen layer: a narrow board with up to
six tiles of one level a page, a level shared evenly between its pages, the page turning in place when
its level's hold is up. Layout `corner`, on the bug layer: the bug's card, its sponsor cell (the level's
heading over one logo) crossfading on each sponsor's level hold. Start reading at
`src/sponsor-roll.ts`; it wires `sponsorRollModel.ts`, `sponsorRollPageTurns.ts`, `sponsorRollView.ts`,
`sponsorRollStyles.ts`, `sponsorRollAnimations.ts` and `ptBR.ts`. Preview:
`pnpm --filter @bajaovrlay/sponsor-roll dev`, then http://localhost:5214/preview.html (`?layout=corner`,
`?stage=grey|black`, `?data=<JSON>`). Tests: `… test`; Playwright with the screenshots: `… test:e2e`.

## A typical item: the round of the 30ª Competição's sponsors

| Field (form label) | Value in the item editor                                                |
| ------------------ | ----------------------------------------------------------------------- |
| Camada (editor)    | Tela cheia (`fullscreen`); Bug (`bug`) for the corner                   |
| Formato            | Valor digitado: Tela cheia, or Canto (no lugar do bug)                  |
| Patrocinadores     | Lista dos cadastros › Patrocinadores ("Valor agora: 17 patrocinadores") |
| Palavra do evento  | Valor digitado: ENDURO (the corner only)                                |

The layer does not follow "Formato": a new item opens on the package's one default layer,
Tela cheia (`fullscreen`). For the corner choose "Bug" in Camada yourself, or the corner card
sits on the full-screen layer instead of the sponsor bug's (decided at gate 2 of PR #28).
