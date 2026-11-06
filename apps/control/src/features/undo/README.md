# apps/control/src/features/undo

Undo on program (BAJAOVRLAY-30, concept §7 rule 5). The server remembers what each layer
showed before its last ten changes (the `programHistory` slice); this folder only offers the
presses and says, before each, what comes back.

- `whatUndoBringsBack.ts` — the tooltips: "Volta: "Tarja – Ana Souza"" for one layer, and for
  "Desfazer última" every layer of the newest change in Camadas' order. Start here.
- `UndoOnLayerButton.tsx` — "Desfazer" on a Camadas row (`undoOnLayer`); the row draws it only
  when its layer has something to undo (features/layers/LayerStatusRow.tsx).
- `UndoLastChangeButton.tsx` — "Desfazer última" beside "Limpar tudo" (`undoLastChangeOnProgram`),
  always on screen, and Ctrl+Z (src/keyboard/keyboardMap.ts, `undoLastChange`).
