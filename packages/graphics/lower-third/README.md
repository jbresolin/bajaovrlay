# lower-third (`@bajaovrlay/lower-third`)

The lower third ("Tarja") OGraf graphic in Ardósia (design: `docs/design/directions/ardosia/lower-third.html`):
a 64 px name pill bottom-left at x 96, and under it a 40 px role pill with the role, a dot and the
muted team line, the lower pill ending at y 940, on the `lower-third` layer. Only `name` is required;
without `role` and `teamLine` the role pill is left out and the name pill stands alone at the bottom.
The design's car chip in the role pill is not drawn (this task gives the graphic no car number).
Start reading at `src/lower-third.ts` (the OGraf lifecycle, same as the notice's); it wires
`lowerThirdModel.ts`, `lowerThirdView.ts`, `lowerThirdStyles.ts`, `lowerThirdAnimations.ts`, `ptBR.ts`.
Typical item, in the item editor: "Nome" ← Cadastro, Pessoa, "Nome"; "Função" ← the same person,
"Função"; "Equipe" typed (`BAJA UFPR · UFPR`), or ← Cadastro, Equipe of car N, "Nome da equipe".
Preview: `pnpm --filter @bajaovrlay/lower-third dev`, then http://localhost:5190/preview.html
(add `?data=<url-encoded JSON>` and `&stage=grey` or `&stage=black`). Unit tests:
`pnpm --filter @bajaovrlay/lower-third test`; Playwright on the built `dist/`:
`pnpm --filter @bajaovrlay/lower-third test:e2e` (after a deliberate visual change add `--update-snapshots`).
