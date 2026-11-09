# notice (`@bajaovrlay/notice`)

The notice OGraf graphic in Ardósia (design: PR #21, catalogue sections 6 and 7): a 420 px card
top-left under the bug, on the `notice` layer. Two variants: `fastestLap` (green MELHOR VOLTA badge
and VOLTA n in the head; chip, team, school and the lap time) and `penalty` (warning triangle, the
kind word and DIREÇÃO DE PROVA; chip, team, school, then the reason and the navy penalty cell).
A team with its school, or a reason, too long for the 420 px card scrolls inside its box instead of
an ellipsis (the kit's `scrollingTextWhenTooLong`, BAJAOVRLAY-55).
Start reading at `src/notice.ts` (the OGraf lifecycle, same as the race clock's: load once, play
in, stop out, update in place any time after load, every call answers a status, never throws);
it wires `noticeModel.ts` (Zod data, required: `variant`, `carNumber`), `noticeView.ts` (both
variants' parts, hidden when a field is missing), `noticeStyles.ts`, `noticeAnimations.ts`, `ptBR.ts`.
It never leaves by itself: the design's 8 s `--motion-notice-hold` is the server's event rule's
auto-out, so the server's state and the screen always agree (trade-off written in `notice.ts`).
Preview: `pnpm --filter @bajaovrlay/notice dev`, then http://localhost:5179/preview.html (add
`?data=<url-encoded JSON>`). Unit tests: `pnpm --filter @bajaovrlay/notice test`; Playwright on
the built `dist/` under `/graphics/notice/`: `pnpm --filter @bajaovrlay/notice test:e2e`
(after a deliberate visual change add `--update-snapshots`).
