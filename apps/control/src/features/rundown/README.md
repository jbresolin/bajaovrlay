# apps/control/src/features/rundown

The left column: the items prepared for a session, in firing order, with the cursor on
the next one. Start reading at `RundownPanel.tsx`. No order or cursor is kept here: after
a drop the rows wait for the server's next slice.

- `RundownPanel.tsx` — reads the `rundowns` and `items` slices, shows the first rundown,
  sends `takeItem`, `deleteItem`, `reorderItems`; opens `features/items/ItemEditorPanel`.
- `RundownItemList.tsx` (dnd-kit: mouse and keyboard drag) and `RundownItemRow.tsx` (handle,
  colour, label, graphic, layer, "Disparar", "Editar", "Excluir"; `ItemColorChip.tsx`).
- `useRundownKeyboardShortcuts.ts` — Space = `takeNext`, Right arrow = `moveCursor`.
- `useEscapeBelongsToTheDragWhileDragging.ts` — the Esc that cancels a drag never arms "Limpar tudo".
- Pure helpers: `itemsOfRundownInOrder.ts`, `itemIdsInOrderAfterDrag.ts` (the full id list
  a drop sends), `itemAfterCursor.ts` (where the Right arrow goes), `graphicAndLayerNames.ts`.
- `rundownDragAnnouncements.ts` — what a screen reader hears during a drag, in pt-BR.
