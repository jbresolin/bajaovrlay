# lower-third (`@bajaovrlay/lower-third`)

The lower third ("Tarja") in Ardósia (design: `docs/design/directions/ardosia/lower-third.html`), on the `lower-third` layer:
a 64 px name pill over a 40 px role pill (the role, a dot, the muted team line), the lower pill ending at y 940.
Only `name` is required; without `role` and `teamLine` the name pill stands alone at the bottom. No car chip (no car number field).
Each pill stops at `--lower-third-max-width` (1300 px); past it its text scrolls inside (the kit's `scrollingTextWhenTooLong`, BAJAOVRLAY-55).
"Posição" (`position`, BAJAOVRLAY-85): Esquerda (`left`, the default, pixel for pixel as before: x 96), Centro (`center`, centred on
x 960) or Direita (`right`, right edges at 1824, lined up right); text reads left to right and the rise-and-fade motion is the same in all.
Start reading at `src/lower-third.ts` (the OGraf lifecycle); it wires `lowerThirdModel.ts`, `lowerThirdView.ts`,
`lowerThirdStyles.ts`, `lowerThirdAnimations.ts` and `ptBR.ts`.
Typical item: "Nome" and "Função" ← Cadastro, Pessoa; "Equipe" typed (`BAJA UFPR · UFPR`) or ← Cadastro, Equipe of car N.
Preview: `pnpm --filter @bajaovrlay/lower-third dev`, then http://localhost:5190/preview.html
(`?data=<url-encoded JSON>`, with a `"position"` for Centro or Direita, and `&stage=grey` or `&stage=black`).
Tests: `pnpm --filter @bajaovrlay/lower-third test`; Playwright on the built `dist/`: `... test:e2e`
(after a deliberate visual change add `--update-snapshots`).
