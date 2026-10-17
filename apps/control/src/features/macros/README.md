# apps/control/src/features/macros

The "Macros" tab of the quick-fire strip: a button per macro and the macro editor. Start at
`MacroGrid.tsx`. A macro runs on the server (its runner sends each step); the page only sends
`runMacro`, `previewMacro` or `stopMacro` and shows the `macroRuns` slice.

- `MacroGrid.tsx` — "+ Macro", the editor while open, the grid in the server's order.
- `MacroButton.tsx` — one macro in its colour; click = run; "⋯" (or right-click) = "Executar",
  "Prévia" (its end state on the preview output), "Editar"; "Rodando 2/3" and "Parar" while it runs.
- `useStopRunningMacroKey.ts` — the key P: stopMacro for the running macro, from any tab.
- `MacroEditorPanel.tsx` — label, colour, steps; "Salvar macro", two-press "Excluir macro".
- `MacroStepList.tsx`, `MacroStepRow.tsx`, `macroStepDragAnnouncements.ts` — the steps, dragged
  with dnd-kit as in the rundown; `macroStepChoices.ts` — the items a step may name.
- `macroStepDrafts.ts`, `macroCommandsFromEditor.ts` — rows → `steps`, and `createMacro` /
  `updateMacro` with only what changed. Pure; their tests are the tables to read.
