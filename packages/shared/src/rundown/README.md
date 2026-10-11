# packages/shared/src/rundown

Rundowns and items: an item is a prepared use of a graphic (graphic, layer, a value
per field, label, colour, notes), and a rundown is the ordered list of items of one
session with a cursor on the item that goes next. Start reading at `item.ts` and
`rundown.ts` (the two slices), then `fieldValue.ts` (how a field gets its value; only
`literal` until M2) and `itemColor.ts` (the six colour names).

Each command has its own file: `createItem.ts`, `updateItemFields.ts`, `deleteItem.ts`,
`reorderItems.ts`, `moveCursor.ts`, `takeItem.ts`, `takeNext.ts`. They are part of the
`Command` union in `../commands/command.ts`, and the ways they can be refused are in
`../commands/commandError.ts`. The rules each one follows live in the server's
reducers (apps/server/src/core/store/reducers/).

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
