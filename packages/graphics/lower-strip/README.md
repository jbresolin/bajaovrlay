# lower-strip (`@bajaovrlay/lower-strip`)

The lower strip OGraf graphic in Ardósia (design: PR #19, the `lower-strip` and `combo-strip`
pages), on the `ticker` layer along the bottom: the clock block (the race time at 44 px and the
flag pill, the kit's, the same text as the race clock's card), the running order six cars a page
("1º", the car chip, the school's short name) and the page cell ("1/6"). Every
`--motion-strip-hold` the page turns in place, the old pills lifting while the new rise (two
lanes, the kit's `barMotion`); a live update redraws the page on air in place. Start reading at
`src/lower-strip.ts` (lifecycle, motion, the page timer and the clock's frame loop); it wires
`lowerStripModel.ts` (Zod data), `stripPages.ts` (six cars a page, with the measurement),
`lowerStripPageTurns.ts`, `lowerStripView.ts`, `lowerStripStyles.ts` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/lower-strip dev`, then http://localhost:5198/preview.html (the
real 34-car field; add `?clock=off`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/lower-strip test`; Playwright on the built `dist/` (lifecycle, every
page of the real field fitting the bar, screenshots): `pnpm --filter @bajaovrlay/lower-strip test:e2e`.

## A typical item: the strip of the session on air

| Field (form label)  | Value in the item editor                                            |
| ------------------- | ------------------------------------------------------------------- |
| Carros              | Fonte › the positions source › Lista completa, ao vivo (pre-filled) |
| Tempo de referência | Relógio da fonte › the session source (fills the four clock fields) |
| Bandeira            | Fonte › the session source › Bandeira, ao vivo                      |
| Mostrar o relógio   | Valor digitado: on (off while the race clock card is up)            |

Entre sessões sem fonte de sessão, deixe os campos do relógio como Valor digitado.
