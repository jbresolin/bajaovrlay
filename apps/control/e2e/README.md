# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Labels are the clock manifest's titles.

- `takeAndClear.e2e.ts` (start here) — "Edição rápida", a page at `/render/` as OBS: "Colocar
  no ar" ("No ar" within 3 s), "Atualizar" (same element), reload, "Limpar". Then with no OBS: the
  layer stays "Carregando", because the "Programa" monitor (`/render/?monitor=1`) never reports.
- Preview (shared steps in `previewTestSteps.ts`): `previewThenTake.e2e.ts` — a second stand-in at
  `/render/?target=preview`: "Prévia", "Tomar", reloads, "Descartar"; `previewKeyboardLoop.e2e.ts` —
  → then Space; Space ×3; Backspace; `previewTakeWithTomar.e2e.ts` — "Tomar" previews the next
  item; `autoPreviewAcrossLayers.e2e.ts` — arrows across two layers.
- `monitorsSideBySide.e2e.ts` — both monitors side by side, equal and 16:9 at three window widths.
- `itemUpdateOnAir.e2e.ts` ("Atualizar no ar" in place), `clockStoppedOnAir.e2e.ts` (a stopped clock
  keeps its time), `rundownTakeWithSpace.e2e.ts` (Space, Left arrow, reload, "Excluir").
- `emptyTheServerState.ts` — called before each test; `emptyServerState.e2e.ts` proves it.

`../playwright.config.ts` starts the real server (5187, new SQLite file) and the control dev server (5188). Run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`.
