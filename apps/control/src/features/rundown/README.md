# apps/control/src/features/rundown

The left column: the items prepared for a session, in firing order, with the cursor on
the next one. Start reading at `RundownPanel.tsx`. No order or cursor is kept here: after
a drop or a click the rows wait for the server's next slice.

- `RundownPanel.tsx` — reads the `rundowns` and `items` slices, shows the first rundown, sends
  `takeItem`, `moveCursor`, `deleteItem`, `reorderItems`; opens `features/items/ItemEditorPanel`.
- `RundownItemList.tsx` (dnd-kit: mouse and keyboard drag) and `RundownItemRow.tsx` (handle,
  colour, the label that sets the cursor, "Disparar", "Editar"; `ItemColorChip.tsx`).
- `DeleteItemButton.tsx` — "Excluir" deletes only at a second press within 3 seconds.
- `useRundownKeyboardShortcuts.ts` — Space = `takeNext` (always, also on a focused button),
  Right / Left arrow = `moveCursor`; `itemAfterCursor.ts`, `itemBeforeCursor.ts` say where to.
- `useEscapeBelongsToTheDragWhileDragging.ts` (Esc cancelling a drag never arms "Limpar tudo"),
  `itemIdsInOrderAfterDrag.ts`, `graphicAndLayerNames.ts`, `rundownDragAnnouncements.ts` (pt-BR).
