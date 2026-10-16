# apps/control/src/features/keyboardHelp

The "?" button of the page header and the dialog it opens: every keyboard shortcut of the page,
with its key, what it does and when it works. Start at `KeyboardMapDialog.tsx`.

- `KeyboardMapDialog.tsx` — the button and the dialog (shadcn Dialog on Radix). The table is
  generated from `src/keyboard/keyboardMap.ts`, so it lists exactly what the listeners do.

Esc closes the dialog and is used up by it, so it never arms "Limpar tudo"; the next Esc does.
The shortcuts themselves keep working while the dialog is open.
