# apps/control/src/features/rundown

The left column: the items prepared for a session, in firing order, with the cursor on the next one.
Start at `RundownPanel.tsx`. No order or cursor is kept here: rows wait for the server's next slice.

- `RundownPanel.tsx` — shows the first rundown (`rundownShownOnPage.ts`); sends `takeItem`,
  `previewItem`, `deleteItem`, `reorderItems`, `moveItemToHome`; draws the page's one item editor
  (`features/items/`), which the quick-fire strip and "Edição rápida" open too. Rows:
  `RundownItemList.tsx` (dnd-kit), `RundownItemRow.tsx` (handle, label, "Disparar", "Prévia", "Editar item").
- `RundownRowMoreActionsMenu.tsx` + `moveToShortcutsChoices.ts` — a row's "⋯" (or right-click):
  "Mover para atalhos", one entry per quick-fire panel in tab order when there are several.
- "Prévia automática": `AutoPreviewToggle.tsx`, `useMoveCursorByHand.ts`; takes go through `features/autoPreview/`.
- `useRundownKeyboardShortcuts.ts` — Space and Shift+Space (`src/keyboard/commandForOperatorKey.ts`),
  Right / Left arrow; `itemAfterCursor.ts`, `itemBeforeCursor.ts` say where to.
- `DeleteItemButton.tsx` (two-press "Excluir", reused by "Excluir macro"), `emptyCursorHint.ts`, `itemIdsInOrderAfterDrag.ts`,
  `useEscapeBelongsToTheDragWhileDragging.ts`, `graphicAndLayerNames.ts`, `rundownDragAnnouncements.ts`.
