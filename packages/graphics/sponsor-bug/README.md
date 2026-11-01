# sponsor-bug (`@bajaovrlay/sponsor-bug`)

The sponsor bug OGraf graphic in Ardósia (design: PR #19 and #21, the `sponsor-bug` page), on the
`bug` layer, top-left all day: the white Baja SAE Brasil mark, the event word ("ENDURO") and the
sponsor cell ("Apresentado por" over one sponsor's logo, on the card or on the small light plate).
Every field is optional: without a sponsor logo the card is the mark and the word alone, never an
empty cell; it never pulses or cycles (cycling sponsors is the corner roll, BAJAOVRLAY-26). The event
word and the caption scroll inside their box when too long for the 300 px card (the kit's
`scrollingTextWhenTooLong`, BAJAOVRLAY-55). Start
reading at `src/sponsor-bug.ts` (the team card's lifecycle: load once, play in, stop out, update in
place any time after load, every call answers a status, never throws); it wires
`sponsorBugModel.ts` (Zod data and the cells), `sponsorBugView.ts`, `sponsorBugStyles.ts`,
`sponsorBugAnimations.ts`, the kit's `waitForImagesToSettle` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/sponsor-bug dev`, then http://localhost:5196/preview.html (add
`?sponsor=off`, `?word=off`, `?plate=off`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/sponsor-bug test`; Playwright on the built `dist/`, with the screenshots:
`pnpm --filter @bajaovrlay/sponsor-bug test:e2e` (add `--update-snapshots` after a deliberate visual
change).

## A typical item: the bug presented by a sponsor from Cadastros

| Field (form label)     | Value in the item editor                                  |
| ---------------------- | --------------------------------------------------------- |
| Palavra do evento      | Valor digitado: ENDURO (or cleared, for no word)          |
| Legenda                | Valor digitado: Apresentado por (the default)             |
| Logo do patrocinador   | Cadastro › Patrocinador (by name) › Logo                  |
| Logo sobre placa clara | Cadastro › the same patrocinador › Logo sobre placa clara |

A sponsor with no logo in Cadastros leaves the logo out, and the bug draws the mark and the word.
