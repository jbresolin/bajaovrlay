# sessions-board (`@bajaovrlay/sessions-board`)

The sessions board OGraf graphic in Ardósia (BAJAOVRLAY-46; design: the `sessions-board` page of
PR #21), on the fullscreen layer: a narrow board with the day's schedule, one pill per slot (the
start's time, the session, its state as a shape and a word). Each slot's state is worked out on air
from the server-aligned clock with shared's own findStatusOfScheduleSlot, re-checked on a timer
booked for the next start or end, and crossfades when it changes. Up to twelve slots fit; with more,
twelve from two before the slot in progress. Start reading at `src/sessions-board.ts`; it wires
`sessionsBoardModel.ts`, `sessionsBoardWindow.ts`, `sessionsBoardView.ts`, `sessionsBoardStyles.ts`,
`sessionsBoardAnimations.ts` and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/sessions-board dev`,
then http://localhost:5212/preview.html (`?stage=grey|black`, `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/sessions-board test`; Playwright with the screenshots: `… test:e2e`.

## A typical item: the day's schedule from Cadastros

| Field (form label) | Value in the item editor                                     |
| ------------------ | ------------------------------------------------------------ |
| Título do quadro   | Valor digitado: PROGRAMAÇÃO DO DIA (the default)             |
| Linha do evento    | Valor digitado: 30ª Competição Baja SAE Brasil               |
| Linha da data      | Valor digitado: domingo, 30 de março de 2025                 |
| Sessões            | Lista dos cadastros › Programação ("Valor agora: 6 sessões") |
