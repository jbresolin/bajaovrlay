# apps/control/src/features/rundown

The left column: the items prepared for a session, in firing order, with the cursor on the next one.
Start at `RundownPanel.tsx`. No order or cursor is kept here: rows wait for the server's next slice.

- `RundownPanel.tsx` — shows the first rundown (`rundownShownOnPage.ts`); sends `takeItem`,
  `previewItem`, `deleteItem`, `reorderItems`; draws the page's one item editor
  (`features/items/`), which the quick-fire strip opens too. Rows:
  `RundownItemList.tsx` (dnd-kit), `RundownItemRow.tsx` (handle, label, "Disparar", "Prévia", "Editar").
- "Prévia automática": `AutoPreviewToggle.tsx` and `useMoveCursorByHand.ts` (`moveCursor`, then
  `previewItem` origin `auto`) read the page's setting store; takes go through `features/autoPreview/`.
- `useRundownKeyboardShortcuts.ts` — Space and Shift+Space (`src/keyboard/commandForOperatorKey.ts`),
  Right / Left arrow; `itemAfterCursor.ts`, `itemBeforeCursor.ts` say where to.
- `DeleteItemButton.tsx` (two-press "Excluir", reused by "Excluir macro"), `emptyCursorHint.ts`, `itemIdsInOrderAfterDrag.ts`,
  `useEscapeBelongsToTheDragWhileDragging.ts`, `graphicAndLayerNames.ts`, `rundownDragAnnouncements.ts`.
