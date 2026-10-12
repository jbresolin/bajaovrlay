# apps/control/src/keyboard

Keyboard shortcuts for the operator. Start reading at `useKeyboardShortcut.ts`.

- `useKeyboardShortcut.ts` — one hook: "call this when that key is pressed anywhere on the
  page", with the guards every shortcut needs (no auto-repeat, no Ctrl/Alt/Meta, no key
  another control already used, optionally not on a text field, a dropdown or a switch, and
  optionally keeping the key from the browser). It tells the shortcut whether Shift was down.
- `commandForOperatorKey.ts` — one pure function: which command Space, Shift+Space and
  Backspace send, given the rundown and the instances (they depend on what is previewed).
  Its test is the table to read.

The listeners live with their feature: Esc in `features/playout/ClearAllButton.tsx`, Backspace
in `features/playout/useBackspaceToStopPreviewOrClearClockLayer.ts`, Space, Shift+Space and the
Right and Left arrows in `features/rundown/useRundownKeyboardShortcuts.ts`.
