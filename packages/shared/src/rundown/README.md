# packages/shared/src/rundown

Rundowns and items: an item is a prepared use of a graphic (graphic, layer, a value
per field, label, colour, notes), and a rundown is the ordered list of items of one
session with a cursor on the item that goes next. An item lives in a rundown or a
quick-fire panel (`itemHome.ts`; panels are in `../quickFire/`). Start reading at
`item.ts` and `rundown.ts` (the two slices), then `fieldValue.ts` (how a field gets its value: a
`literal` as typed, or `takeTime`, the wall-clock milliseconds of the take; bindings
arrive in M2) and `itemColor.ts` (the six colour names).

One file per command (`createItem.ts`, `updateItemFields.ts`, `deleteItem.ts`,
`reorderItems.ts`, `moveCursor.ts`, `takeItem.ts`, `takeNext.ts`, `moveItemToHome.ts`),
all in the `Command` union of `../commands/command.ts`; their rules live in the server's
reducers. `itemsOfRundownInOrder.ts` lists a rundown's or a panel's items first to last.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
