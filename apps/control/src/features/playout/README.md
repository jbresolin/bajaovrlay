# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `TakeRaceClockPanel.tsx`. The form
is hand-written from the manifest; BAJAOVRLAY-14 generates forms from each schema.

- `TakeRaceClockPanel.tsx` — the race clock form with "Colocar no ar" and "Atualizar";
  `RaceClockFormFields.tsx` draws its six fields, `FormFieldRow.tsx` one labelled field.
- `raceClockTakeForm.ts` — the form's values, rules (pt-BR messages) and the `takeGraphic`
  command; `raceClockTakeFormResolver.ts` hands the rules to react-hook-form;
  `minutesAndSeconds.ts` reads and writes a time as mm:ss.
- `raceClockInstanceToFollow.ts` finds the clock on air (any layer; the latest of several),
  `raceClockDataOnAir.ts` reads it, `raceClockInstanceUpdate.ts` builds "Atualizar"'s
  `updateInstanceData` with the changed fields only (in-place update).
- `ClearAllButton.tsx` (red panic button and Esc, two presses within 3 s),
  `useBackspaceToClearClockLayer.ts`, `CommandErrorMessage.tsx` (why a command failed).
