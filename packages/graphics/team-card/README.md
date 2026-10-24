# team-card (`@bajaovrlay/team-card`)

The team card OGraf graphic in Ardósia (design: PR #21, catalogue entry 1), on the `lower-third`
layer: the big blue chip, the team's name, the school and "CAMPINAS · SP" under it, the car's photo
at the left and the team's logo at the right (on the panel, or on a small light plate with
`logoOnLightPlate`). Photo, logo and city are each optional; a missing one is not drawn at all, so
the card is narrower or shorter, never an empty frame. Start reading at `src/team-card.ts` (the
OGraf lifecycle, the notice's: load once, play in, stop out, update in place any time after load,
every call answers a status, never throws); it wires `teamCardModel.ts` (Zod data, the cells and the
width of each combination), `teamCardView.ts`, `teamCardStyles.ts`, `teamCardAnimations.ts`,
the kit's `waitForImagesToSettle` (load waits up to 2 s for the images; a broken one never blocks) and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/team-card dev`, then http://localhost:5192/preview.html (add
`?photo=off`, `?logo=off`, `?city=off`, `?plate=off`, `?stage=grey|black` or `?data=<JSON>`). Unit
tests: `pnpm --filter @bajaovrlay/team-card test`; Playwright on the built `dist/`, with the 16
screenshots: `pnpm --filter @bajaovrlay/team-card test:e2e` (add `--update-snapshots` after a
deliberate visual change).

## A typical item: team N from Cadastros

Every field is named after the team entity's attribute, so in the item editor each field reads
"Cadastro", entity Equipe, the team by its car number (say 7), and the attribute of the same name:

| Field (form label)     | Value in the item editor                     |
| ---------------------- | -------------------------------------------- |
| Carro                  | Cadastro › Equipe 7 › Número do carro        |
| Equipe                 | Cadastro › Equipe 7 › Nome da equipe         |
| Escola                 | Cadastro › Equipe 7 › Escola (sigla)         |
| Cidade                 | Cadastro › Equipe 7 › Cidade                 |
| Estado (UF)            | Cadastro › Equipe 7 › UF                     |
| Foto do carro          | Cadastro › Equipe 7 › Foto do carro          |
| Logo da equipe         | Cadastro › Equipe 7 › Logo                   |
| Logo sobre placa clara | Cadastro › Equipe 7 › Logo sobre placa clara |

A team with no city, photo or logo in Cadastros leaves that field out, and the card draws without it.
