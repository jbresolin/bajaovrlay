# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `QuickEditPanel.tsx`. Nothing
here knows a graphic by name: forms come from each manifest (`features/schemaForm`).

- `QuickEditPanel.tsx` — "Edição rápida": the graphic dropdown and, per graphic, a fresh
  `QuickEditForm.tsx` with "Colocar no ar" (`takeGraphic`, default layer) and "Atualizar"
  (`updateInstanceData`, changed fields only). `graphicForQuickEdit.ts` chooses the graphic
  shown; `instanceOfGraphicToFollow.ts` finds its instance on air (the latest of several).
- A clock on air shows the time on screen, live, in its untouched time field; the form still
  holds the reading on air, so that text is never sent. `clockRolesOfCarryClockForward.ts`
  (the manifest words, paired with the server rule) → `clockFieldsOfGraphic.ts` (finds the
  four fields) → `timeOnScreenOfClockOnAir.ts` (shared sum) → `useTimeOnScreenInQuickEdit.ts`.
- `ClearAllButton.tsx` (panic button and Esc), `useBackspaceToClearClockLayer.ts`,
  `CommandErrorMessage.tsx`; `*.testSupport.*` — the panel on a fake server, for the tests.
