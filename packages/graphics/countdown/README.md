# countdown (`@bajaovrlay/countdown`)

The countdown OGraf graphic in Ardósia (BAJAOVRLAY-46; design: the `countdown` and
`countdown-tela-cheia` pages of PR #21): the count to a session's start, `startsAtMs`. Layout
`card` is the race clock's card without the band, on the clock layer, replacing the race clock
between sessions; layout `fullscreen` is the narrow waiting board ("PRÓXIMA SESSÃO", the count at
160 px), on the fullscreen layer. The graphic counts by itself on the server-aligned clock (the kit's
countdownClock) and stops at "0:00"; a start moved in Cadastros moves the target. A session name
or event line too long for its box scrolls inside it (the kit's `scrollingTextWhenTooLong`,
BAJAOVRLAY-55). Start reading at
`src/countdown.ts`; it wires `countdownModel.ts`, `countdownView.ts`, `countdownStyles.ts`,
`countdownAnimations.ts` and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/countdown dev`, then
http://localhost:5210/preview.html (`?layout=fullscreen`, `?stage=grey|black`, `?data=<JSON>`).
Unit tests: `pnpm --filter @bajaovrlay/countdown test`; Playwright on the built `dist/`, with the
screenshots: `pnpm --filter @bajaovrlay/countdown test:e2e`.

## A typical item: the card before the enduro, from the schedule in Cadastros

| Field (form label) | Value in the item editor                                          |
| ------------------ | ----------------------------------------------------------------- |
| Camada (editor)    | Relógio (`clock`); Tela cheia for the waiting screen              |
| Formato            | Valor digitado: Cartão (no lugar do relógio), or Tela cheia       |
| Sessão             | Cadastro › Sessão da programação (Enduro de Resistência) › Sessão |
| Largada            | Cadastro › the same sessão › Início (or typed as date and time)   |
| Linha do evento    | Valor digitado: 30ª Competição Baja SAE Brasil (tela cheia only)  |
| Linha da data      | Valor digitado: domingo, 30 de março de 2025 (tela cheia only)    |

The layer does not follow "Formato": a new item opens on the package's one default layer,
Relógio (`clock`). For the waiting screen choose "Tela cheia" in Camada yourself, or the
full-screen countdown replaces the race clock (decided at gate 2 of PR #28).
