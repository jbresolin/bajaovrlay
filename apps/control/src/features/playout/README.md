# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `QuickEditPanel.tsx`. Nothing
here knows a graphic by name: forms come from each manifest (`features/schemaForm`).

- `QuickEditPanel.tsx` — "Edição rápida": edits ONE instance loaded by a "Camadas" row's "Editar"
  (or "Editar prévia"), or makes a new entry; `QuickEditChoiceProvider.tsx` holds that choice,
  `quickEditMode.ts` says which it is (and why an instance was let go, as first seen),
  `QuickEditHeading.tsx` says it on screen, `QuickEditGraphicAndLayerChoice.tsx` the two dropdowns.
- `QuickEditForm.tsx` + `QuickEditButtons.tsx` + `useQuickEditCommands.ts` — "Colocar no ar",
  "Prévia", "Atualizar" (that instance's id only) and "Salvar como item" (`itemSavedFromQuickEdit.ts`).
- A loaded clock shows the time on screen, live, in its untouched time field (never sent):
  `clockRolesOfCarryClockForward.ts` → `clockFieldsOfGraphic.ts` → `timeOnScreenOfClockOnAir.ts`
  → `useTimeOnScreenInQuickEdit.ts`.
- `ClearAllButton.tsx` (panic button and Esc), `CommandErrorMessage.tsx`; `*.testSupport.*` for tests.
