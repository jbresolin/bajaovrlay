# message-ticker (`@bajaovrlay/message-ticker`)

The message ticker OGraf graphic in Ardósia (design: PR #21, catalogue entry 13, the
`message-ticker` and `combo-ticker` pages), on the `ticker` layer: the strip's bar with the clock
block (the kit's, when shown), an "AVISO" label pill in the denser slate, one announcement a page
and the page cell ("1/3"). Every `--motion-strip-hold` the message turns in place (two message
pills, the kit's `barMotion`) and never scrolls. A message is at most 50 characters, the label 10,
the list 1 to 9 messages: `src/messageLimits.ts` holds the numbers with their measurement, the
manifest repeats them, so the item editor refuses a message that would not fit, in pt-BR.
Start reading at `src/message-ticker.ts`; it wires `messageTickerModel.ts`,
`messageTickerPageTurns.ts`, `messageTickerView.ts`, `messageTickerStyles.ts` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/message-ticker dev`, then http://localhost:5200/preview.html (add
`?clock=off`, `?messages=1`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/message-ticker test`; Playwright on the built `dist/` (lifecycle, the
longest message fitting the bar, screenshots): `pnpm --filter @bajaovrlay/message-ticker test:e2e`.

## A typical item: the day's announcements

| Field (form label)  | Value in the item editor                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rótulo do aviso     | Valor digitado: AVISO (the default)                                                                                |
| Mensagens           | Valor digitado: one line per message ("Adicionar mensagem"); during the event, add one and press "Atualizar no ar" |
| Tempo de referência | Relógio da fonte › the session source (fills the four clock fields)                                                |
| Bandeira            | Fonte › the session source › Bandeira, ao vivo                                                                     |
| Mostrar o relógio   | Valor digitado: on (off with the race clock card up, or between sessions)                                          |
