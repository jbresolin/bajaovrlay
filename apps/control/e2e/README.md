# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Labels are the clock manifest's titles.

- `takeAndClear.e2e.ts` (start here) — "Edição rápida", a page at `/render/` as OBS: "Colocar no ar" ("No ar"
  within 3 s), "Atualizar", reload, "Limpar"; with no OBS the layer stays "Carregando" (the monitor never reports).
- Preview (steps in `previewTestSteps.ts`): `previewThenTake.e2e.ts` ("Prévia", "Tomar", "Descartar"), `previewKeyboardLoop.e2e.ts`
  (→, Space ×3, Backspace), `previewTakeWithTomar.e2e.ts`, `autoPreviewAcrossLayers.e2e.ts` (arrows across two layers).
- `monitorsSideBySide.e2e.ts` (equal and 16:9 at three widths), `itemUpdateOnAir.e2e.ts` ("Atualizar no ar"),
  `clockStoppedOnAir.e2e.ts` (a stopped clock keeps its time), `rundownTakeWithSpace.e2e.ts` (Space, ←, "Excluir").
- Quick fire (steps in `quickFireTestSteps.ts`): `quickFireWithNumberKey.e2e.ts` (a button fired with 1, cursor
  unchanged), `macroTakeWaitClear.e2e.ts` (take, wait 0,5 s, clear: the layer is empty after 0.4–3 s).

`emptyTheServerState.ts` empties the server before each test, panels and macros included (`emptyServerState.e2e.ts`
proves it). `../playwright.config.ts` starts the real server (5187, new SQLite file) and the control dev server (5188). Run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`.
