# apps/control/src/features/rundown

The left column: the items prepared for a session, in firing order, with the cursor on the next one.
Start at `RundownPanel.tsx`. No order or cursor is kept here: rows wait for the server's next slice.

- `RundownPanel.tsx` — shows the first rundown; sends `takeItem`, `previewItem`, `deleteItem`,
  `reorderItems`; opens `features/items/ItemEditorPanel`. Rows: `RundownItemList.tsx` (dnd-kit)
  and `RundownItemRow.tsx` (handle, label that sets the cursor, "Disparar", "Prévia", "Editar").
- "Prévia automática" (`AutoPreviewToggle.tsx`; `autoPreviewSetting.ts`, localStorage): while on,
  `useMoveCursorByHand.ts` (`moveCursor`) and `useTakeThenPreviewNextItem.ts` (a take sent here;
  `itemToPreviewAfterTake.ts` decides) then send `previewItem` with origin `auto`.
- `useRundownKeyboardShortcuts.ts` — Space and Shift+Space (`src/keyboard/commandForOperatorKey.ts`),
  Right / Left arrow; `itemAfterCursor.ts`, `itemBeforeCursor.ts` say where to.
- `DeleteItemButton.tsx` (two-press "Excluir"), `emptyCursorHint.ts`, `itemIdsInOrderAfterDrag.ts`,
  `useEscapeBelongsToTheDragWhileDragging.ts`, `graphicAndLayerNames.ts`, `rundownDragAnnouncements.ts`.
