# apps/control/src/keyboard

Keyboard shortcuts for the operator. Start reading at `keyboardMap.ts`.

- `keyboardMap.ts` — the single source of truth: every shortcut with its keys, where it is left
  alone (typing), whether it is kept from the browser, its commands and its pt-BR words (from
  `src/i18n/ptBRKeyboard.ts`). The listeners read their keys and rules from it, and the "?"
  dialog (`features/keyboardHelp/`) lists it. Its test pins the rules decided so far.
- `useKeyboardShortcut.ts` — "call this when one of that entry's keys is pressed", with the guards
  every shortcut shares (no auto-repeat, no Ctrl/Alt/Meta, no key another control already used).
- `commandForOperatorKey.ts` — what Space, Shift+Space and Backspace send, given the previews.

The listeners live with their feature: Esc in `features/playout/ClearAllButton.tsx`, Backspace in
`features/outputMonitors/useBackspaceToStopPreview.ts`, Space, Shift+Space and the arrows in
`features/rundown/useRundownKeyboardShortcuts.ts`, 1–9 and F1–F4 in `features/quickFire/useQuickFireKeys.ts`, P in
`features/macros/useStopRunningMacroKey.ts`.
