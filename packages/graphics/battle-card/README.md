# battle-card (`@bajaovrlay/battle-card`)

The battle card OGraf graphic in Ardósia (design: PR #21, catalogue entry 2), on the `lower-third`
layer, bottom-centre: two cars fighting for one place, each a 72 px pill (position, car chip, team
over school, laps), and between them the gap at 44 px over its trend, "▸◂ FECHANDO −0,7" in green,
"◂▸ ABRINDO +0,7" in the down cue's blue or "— ESTÁVEL" muted. Start reading at `src/battle-card.ts`
(the OGraf lifecycle, the team card's: load once, play in, stop out, update in place any time after
load, every call answers a status, never throws); it wires `battleCardModel.ts` (Zod data, the gap
text), `battleTrend.ts` (the trend remembered from lap to lap, and its trade-off), `battleCardView.ts`,
`battleCardStyles.ts`, `battleCardAnimations.ts` (in one lead apart, out together, the trend's
crossfade) and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/battle-card dev`, then
http://localhost:5212/preview.html ("Atualizar" sends the next lap; add `?trend=closing|opening|steady`,
`?stage=grey|black` or `?data=<JSON>`). Unit tests: `pnpm --filter @bajaovrlay/battle-card test`;
Playwright on the built `dist/`, with the 6 screenshots: `pnpm --filter @bajaovrlay/battle-card test:e2e`.

## A typical item: car 8 against car 1, live

Each field reads its own value from the positions, every one "Ao vivo" (live), the cars chosen by
number (Posições › Carro escolhido pelo número › …), car 8 ahead and car 1 behind:

| Field (form label)             | Value in the item editor                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Posição do carro da frente     | Fonte › Posições › Carro escolhido pelo número (8) › Posição                         |
| Número do carro da frente      | Fonte › Posições › Carro escolhido pelo número (8) › Carro                           |
| Equipe do carro da frente      | Fonte › Posições › Carro escolhido pelo número (8) › Equipe                          |
| Escola do carro da frente      | Fonte › Posições › Carro escolhido pelo número (8) › Escola                          |
| Voltas do carro da frente      | Fonte › Posições › Carro escolhido pelo número (8) › Voltas                          |
| Posição do carro de trás       | Fonte › Posições › Carro escolhido pelo número (1) › Posição                         |
| Número do carro de trás        | Fonte › Posições › Carro escolhido pelo número (1) › Carro                           |
| Equipe do carro de trás        | Fonte › Posições › Carro escolhido pelo número (1) › Equipe                          |
| Escola do carro de trás        | Fonte › Posições › Carro escolhido pelo número (1) › Escola                          |
| Voltas do carro de trás        | Fonte › Posições › Carro escolhido pelo número (1) › Voltas                          |
| Diferença entre os carros (ms) | Fonte › Posições › Carro escolhido pelo número (1) › Intervalo para o carro à frente |
| Tendência à mão                | left empty: the card works the trend out at each lap of car 1                        |
| Variação à mão (ms)            | left empty                                                                           |

The trend is remembered by the graphic itself, so a renderer reload or a new take starts it again:
the first lap after that shows "ESTÁVEL" with no number. Choose a "Tendência à mão" (and its change
in ms, without sign) to override it; clearing it gives the worked-out trend back.

The gap is optional (gate 2 of PR #27). It is shown only while it is the gap of these two cars:
the car behind exactly one place behind the car ahead, with an interval. After a pass, with a car
between them, or when the car behind leads (no interval), the card shows "—" with no trend at all,
even one set by hand, and the remembered gap is forgotten. A lap count that jumps by more than one
shows "ESTÁVEL" with no number and the next single lap compares again.
