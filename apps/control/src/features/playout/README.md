# apps/control/src/features/playout

Putting graphics on air and taking them off. Start reading at `TakeRaceClockPanel.tsx`.

- `TakeRaceClockPanel.tsx` — the race clock form with "Colocar no ar" and "Atualizar";
  `RaceClockFormFields.tsx` draws its six fields, `FormFieldRow.tsx` one labelled field.
- `raceClockTakeForm.ts` — the form's values, rules (pt-BR messages), mm:ss conversion
  and the `takeGraphic` command; `raceClockTakeFormResolver.ts` hands the rules to
  react-hook-form.
- `ClearAllButton.tsx` — the red panic button and the Esc key: two presses within 3 s.
- `useBackspaceToClearClockLayer.ts` — Backspace clears the clock layer.
- `CommandErrorMessage.tsx` — shows why the last take or clear failed.

The form is hand-written for M0 and mirrors the race clock's manifest by hand;
BAJAOVRLAY-14 replaces it with forms generated from each graphic's schema.
