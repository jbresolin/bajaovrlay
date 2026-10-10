# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `TakeRaceClockPanel.tsx`.

- `TakeRaceClockPanel.tsx` — the race clock form with "Colocar no ar" and "Atualizar";
  `RaceClockFormFields.tsx` draws its six fields, `FormFieldRow.tsx` one labelled field.
- `raceClockTakeForm.ts` — the form's values, rules (pt-BR messages) and the `takeGraphic`
  command; `raceClockTakeFormResolver.ts` hands the rules to react-hook-form;
  `minutesAndSeconds.ts` reads the time typed as mm:ss.
- `raceClockUpdateCommand.ts` — the command "Atualizar" sends: everything from the form
  except the time, which is the one the clock on air shows (a flag change never resets it).
- `ClearAllButton.tsx` (red panic button and Esc, two presses within 3 s),
  `useBackspaceToClearClockLayer.ts`, `CommandErrorMessage.tsx` (why a command failed).

Hand-written for M0 from the manifest; BAJAOVRLAY-14 generates forms from each schema.
