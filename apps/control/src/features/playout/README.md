# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `TakeRaceClockPanel.tsx`.

- `TakeRaceClockPanel.tsx` — the race clock form with "Colocar no ar" and "Atualizar";
  `RaceClockFormFields.tsx` draws its six fields, `FormFieldRow.tsx` one labelled field.
- `raceClockTakeForm.ts` — the form's values, rules (pt-BR messages) and the `takeGraphic`
  command; `raceClockTakeFormResolver.ts` hands the rules to react-hook-form;
  `minutesAndSeconds.ts` reads and writes a time as mm:ss.
- `raceClockDataOnAir.ts` reads the clock on air; `raceClockInstanceUpdate.ts` builds what
  "Atualizar" sends: `updateInstanceData` with the changed fields only (in-place update).
- `ClearAllButton.tsx` (red panic button and Esc, two presses within 3 s),
  `useBackspaceToClearClockLayer.ts`, `CommandErrorMessage.tsx` (why a command failed).

Hand-written from the manifest; BAJAOVRLAY-14 generates forms from each schema.
