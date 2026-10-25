# podium (`@bajaovrlay/podium`)

The podium OGraf graphic in Ardósia (design: PR #21, catalogue entry 5), on the `fullscreen` layer:
the kit's head card ("PÓDIO", the event, "2/3"), then three cards on the title-safe bottom edge, the
2nd at the left, the 1st in the middle and taller, the 3rd at the right; each with its place (the 1st
on the green chip), the big chip, the team and the school, crowned by the team's logo (on the panel,
or on the light plate with `logoOnLightPlate`, the team card's rule) when it has one. Start reading at
`src/podium.ts` (the OGraf lifecycle); it wires `podiumModel.ts` (Zod data, which entry stands where,
the places, the steps), `podiumStepMoves.ts` (which cards a step reveals, hides or lifts out),
`podiumView.ts`, `podiumStyles.ts`, `podiumAnimations.ts`, the kit's
`boardHead` and `ptBR.ts`. The podium has no timer: nothing on it moves by itself.

**Steps** (`stepCount` 4): play from off air is step 0, the head alone (Entrar); each further play
(Próximo) reveals one card: step 1 the 3rd, step 2 the 2nd, step 3 the 1st, each rising
`--motion-podium-offset` while the others never move; one more play is the end and takes it off air.
A card not yet revealed keeps its room, invisible. The list's order decides who stands where (the
first entry is the middle card); each card writes its own position or rank, so a tie shows the
shared rank on both cards. A list shorter than three leaves the cards past its end empty; entries
past the third are not drawn.

Preview: `pnpm --filter @bajaovrlay/podium dev`, then http://localhost:5210/preview.html (add
`?logos=off`, `?tie=on`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/podium test`; Playwright on the built `dist/`, with the 6 screenshots:
`pnpm --filter @bajaovrlay/podium test:e2e` (add `--update-snapshots` after a deliberate visual change).

## A typical item: the enduro's podium

| Field (form label) | Value in the item editor                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Equipes do pódio   | Fonte › Simulador — Enduro › Posições › Lista completa, Congelado na entrada, Primeiras N entradas (3), then Com logos das equipes |
| Título             | PÓDIO (the default)                                                                                                                |
| Evento             | ENDURO DE RESISTÊNCIA                                                                                                              |

For the overall podium, bind Pontuação › Lista completa the same way. Frozen, so the places do not
change while they are revealed.
