# battle-card (`@bajaovrlay/battle-card`)

The battle card OGraf graphic in Ardósia (design: PR #21, catalogue entry 2), on the `lower-third`
layer, bottom-centre: two cars fighting for one place, each a 72 px pill (position, car chip, team
over school, laps), and between them the gap at 44 px over its trend, "▸◂ FECHANDO −0,7" in green,
"◂▸ ABRINDO +0,7" in the down cue's blue or "— ESTÁVEL" muted. Each car's team column stops at
`--battle-team-max-width`; past it the name or the school scrolls inside its line (the kit's
`scrollingTextWhenTooLong`, BAJAOVRLAY-55). Start reading at `src/battle-card.ts`
(the OGraf lifecycle, the team card's: load once, play in, stop out, update in place any time after
load, every call answers a status, never throws); it wires `battleCardModel.ts` (Zod data, the gap
text), `battleTrend.ts` (the trend remembered from lap to lap, and its trade-off), `battleCardView.ts`,
`battleCardStyles.ts`, `battleCardAnimations.ts` (in one lead apart, out together, the trend's
crossfade), `battleTrendCrossfade.ts` (the crossfade on air, ended at once by stop, dispose or
leaving the page) and `ptBR.ts`. Preview: `pnpm --filter @bajaovrlay/battle-card dev`, then
http://localhost:5204/preview.html ("Atualizar" sends the next lap; add `?trend=closing|opening|steady`,
`?stage=grey|black` or `?data=<JSON>`). Unit tests: `pnpm --filter @bajaovrlay/battle-card test`;
Playwright on the built `dist/`, with the 6 screenshots: `pnpm --filter @bajaovrlay/battle-card test:e2e`.

## A typical item: car 8 against car 1, live

Each car is chosen once (BAJAOVRLAY-66): the manifest groups each car's five fields
(`v_baja.carGroups`), the gap with the car behind, so the item editor shows two pickers in
place of eleven fields, each filling its car's fields alike:

| Picker (item editor) | Choice                                                        | Fields it fills                               |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Carro da frente      | Pelo número do carro › Simulador — Enduro › 8 › Ao vivo       | position, number, team, school, laps of car 8 |
| Carro de trás        | Pelo número do carro › Simulador — Enduro › 1 › Ao vivo       | the same of car 1, and the gap (its interval) |
| Tendência à mão      | left empty: the card works the trend out at each lap of car 1 |                                               |
| Variação à mão (ms)  | left empty                                                    |                                               |

Each field is stored as its own binding, as before the pickers: "Posição do carro da frente"
reads Posições › Carro escolhido pelo número (8) › Posição, and so on. For a battle for a
place rather than two given cars, "Disputa pela posição" › "Disputa pela 2ª posição" picks
the car ahead at the 2nd place and the car behind at the 3rd, so the card follows whichever
cars run there ("Pelo lugar na corrida" does the same for one car). "Campos separados" under a
car shows its fields one by one again; an item whose car's fields follow two cars stays that way
until a way is chosen for the car.

The trend is remembered by the graphic itself, so a renderer reload or a new take starts it again:
the first lap after that shows "ESTÁVEL" with no number. Choose a "Tendência à mão" (and its change
in ms, without sign) to override it; clearing it gives the worked-out trend back.

The gap is optional (gate 2 of PR #27). It is shown only while it is the gap of these two cars:
the car behind exactly one place behind the car ahead, with an interval. After a pass, with a car
between them, or when the car behind leads (no interval), the card shows "—" with no trend at all,
even one set by hand, and the remembered gap is forgotten. A lap count that jumps by more than one
shows "ESTÁVEL" with no number and the next single lap compares again.
