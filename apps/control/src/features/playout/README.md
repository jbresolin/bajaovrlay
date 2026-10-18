# apps/control/src/features/playout

Changing what is on air and taking it off. Start reading at `QuickEditPanel.tsx`. Nothing here
knows a graphic by name: forms come from each manifest (`features/schemaForm`). Since BAJAOVRLAY-37
nothing here puts a new graphic up: everything on air comes from an item.

- `QuickEditPanel.tsx` — "Edição rápida": edits ONE instance loaded by a "Camadas" row's "Editar"
  (or "Editar prévia"); `QuickEditChoiceProvider.tsx` holds that choice, `quickEditMode.ts` says
  whether one is loaded (and why an instance was let go, as first seen), `QuickEditHeading.tsx`
  names it on screen, `QuickEditNothingLoaded.tsx` is the hint and "Novo gráfico…".
- `QuickEditForm.tsx` + `QuickEditButtons.tsx` + `useQuickEditCommands.ts` — "Atualizar" (or
  "Atualizar prévia"): `updateInstanceData` with the changed fields, to that instance's id only.
- A loaded clock shows the time on screen, live, in its untouched time field (never sent):
  `clockRolesOfCarryClockForward.ts` → `clockFieldsOfGraphic.ts` → `timeOnScreenOfClockOnAir.ts`
  → `useTimeOnScreenInQuickEdit.ts`.
- `ClearAllButton.tsx` (panic button and Esc), `CommandErrorMessage.tsx`; `*.testSupport.*` for tests.
