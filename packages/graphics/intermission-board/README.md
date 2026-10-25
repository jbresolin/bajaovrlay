# intermission-board (`@bajaovrlay/intermission-board`)

The intermission board OGraf graphic in Ardósia (BAJAOVRLAY-46; design: the `intermission-board` page
and its four `motion-intermission-*` demos of PR #21), on the fullscreen layer: "INTERVALO", the next
session with its count (the countdown's kit parts, on the server-aligned clock, stopped at "0:00"),
the overall top five (the standings' pills, the kit's standingsRowStyles) and a sponsor line turning
through every sponsor a level at a time (the sponsor roll's paging rule and timer, four logos a page).
The top five and the sponsor line are optional: without the top five the next session takes the
whole width, its words centred; without sponsors there is no line. Start reading at
`src/intermission-board.ts`; it wires `intermissionBoardModel.ts`, `intermissionBoardView.ts`,
`intermissionBoardStyles.ts`, `intermissionBoardAnimations.ts`, `intermissionSponsorLine.ts` and
`ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/intermission-board dev`, then
http://localhost:5216/preview.html (`?topFive=off`, `?sponsors=off`, `?stage=grey|black`,
`?data=<JSON>`). Tests: `… test`; Playwright with the screenshots: `… test:e2e`.

## A typical item: the break after the briefing

| Field (form label)        | Value in the item editor                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| Linha do evento           | Valor digitado: 30ª Competição Baja SAE Brasil                          |
| Linha da data             | Valor digitado: domingo, 30 de março de 2025                            |
| Próxima sessão            | Cadastro › Sessão da programação (Enduro de Resistência) › Sessão       |
| Largada da próxima sessão | Cadastro › the same sessão › Início                                     |
| Cinco primeiros           | Fonte › Pontuação › Lista completa, "Primeiras N entradas" (5), ao vivo |
| Patrocinadores            | Lista dos cadastros › Patrocinadores                                    |
