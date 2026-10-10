# apps/control/src/keyboard

Keyboard shortcuts for the operator. Start reading at `useKeyboardShortcut.ts`.

- `useKeyboardShortcut.ts` — one hook: "call this when that key is pressed anywhere on
  the page", with the guards every shortcut needs (no auto-repeat, no Ctrl/Alt/Meta
  combinations, no key another control already used, optionally not while typing).

The shortcuts themselves live with the feature they belong to: Esc in
`features/playout/ClearAllButton.tsx`, Backspace in
`features/playout/useBackspaceToClearClockLayer.ts`. Space and the arrow keys wait for
the rundown (M1).
