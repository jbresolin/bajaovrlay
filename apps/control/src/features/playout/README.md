# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `QuickEditPanel.tsx`. Nothing
here knows a graphic by name: forms come from each manifest (`features/schemaForm`).

- `QuickEditPanel.tsx` — "Edição rápida": the graphic dropdown and, per graphic, a fresh
  `QuickEditForm.tsx` with "Colocar no ar" (`takeGraphic` on the graphic's default layer)
  and "Atualizar" (`updateInstanceData` with the changed fields only, in place).
- `graphicForQuickEdit.ts` chooses the graphic shown (the one the operator chose or is
  editing, else the latest take on program, else the first listed);
  `instanceOfGraphicToFollow.ts` finds its instance on air (any layer; the latest of several).
- `ClearAllButton.tsx` (red panic button and Esc, two presses within 3 s),
  `useBackspaceToClearClockLayer.ts`, `CommandErrorMessage.tsx` (why a command failed).
- `operatingTheQuickEditPanel.testSupport.tsx` — the panel on a fake server, for the tests.
