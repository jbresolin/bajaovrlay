# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `TakeRaceClockPanel.tsx`.

- `TakeRaceClockPanel.tsx` — the race clock form with "Colocar no ar" and "Atualizar";
  `RaceClockFormFields.tsx` draws its six fields, `FormFieldRow.tsx` one labelled field.
- `raceClockTakeForm.ts` — the form's values, rules (pt-BR messages), mm:ss conversion
  and the `takeGraphic` command; `raceClockTakeFormResolver.ts` hands the rules to
  react-hook-form.
- `raceClockUpdateCommand.ts` — the command "Atualizar" sends: everything from the form
  except the time, which is the one the clock on air shows (a flag change never resets it).
- `ClearAllButton.tsx` (red panic button and Esc, two presses within 3 s),
  `useBackspaceToClearClockLayer.ts`, `CommandErrorMessage.tsx` (why a command failed).

The form is hand-written for M0 and mirrors the race clock's manifest by hand;
BAJAOVRLAY-14 replaces it with forms generated from each graphic's schema.
