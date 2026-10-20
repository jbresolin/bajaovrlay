// Everything about rundowns and items that @bajaovrlay/shared exports. The package's
// own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The `rundowns` slice: the ordered list of a session, with its "next" cursor.
export { type Rundown, RundownSchema } from './rundown.js';
// The `items` slice: a prepared use of a graphic (graphic, layer, field values, label).
export { type Item, ItemSchema } from './item.js';
// Where an item lives (a rundown or a quick-fire panel), and whether two homes are one.
export { isSameItemHome, type ItemHome, ItemHomeSchema } from './itemHome.js';
// How a field of an item gets its value (`literal`, `takeTime` stamped by the server at
// the take, or `binding`, whose schema lives in ../bindings/), and an item's fields.
export {
  type FieldValue,
  FieldValueSchema,
  type ItemFields,
  ItemFieldsSchema,
  type LiteralFieldValue,
  LiteralFieldValueSchema,
  type TakeTimeFieldValue,
  TakeTimeFieldValueSchema,
} from './fieldValue.js';
// The items of one home, a rundown or a quick-fire panel, first to last
// (itemsOfHomeInOrder.ts); the one place that reads the order of a home.
export {
  listItemsOfQuickFirePanelInOrder,
  listItemsOfRundownInOrder,
} from './itemsOfHomeInOrder.js';
// The six named colours of an item, and the one a new item gets.
export { defaultItemColor, type ItemColor, ItemColorSchema } from './itemColor.js';
// The auto-out delay of an item, in whole milliseconds above zero.
export { AutoOutDelayMsSchema } from './autoOutDelay.js';

// createItem: add a prepared item to a rundown or a panel, at the end or at a position.
export { type CreateItemCommand, CreateItemCommandSchema } from './createItem.js';
// updateItemFields: change some field values, the label, colour, notes or auto-out.
export { type UpdateItemFieldsCommand, UpdateItemFieldsCommandSchema } from './updateItemFields.js';
// saveOnAirChangesIntoItem: "Salvar no item", writing what was changed on air into the item.
export {
  type SaveOnAirChangesIntoItemCommand,
  SaveOnAirChangesIntoItemCommandSchema,
  type WallClockFieldsChoice,
  WallClockFieldsChoiceSchema,
} from './saveOnAirChangesIntoItem.js';
// deleteItem: remove an item from its rundown.
export { type DeleteItemCommand, DeleteItemCommandSchema } from './deleteItem.js';
// reorderItems: put a rundown's items in a new order, given as the full list of ids.
export { type ReorderItemsCommand, ReorderItemsCommandSchema } from './reorderItems.js';
// moveCursor: point a rundown's "next" cursor at an item, or at nothing.
export { type MoveCursorCommand, MoveCursorCommandSchema } from './moveCursor.js';
// takeItem: put one item on air and move the cursor to the item after it.
export { type TakeItemCommand, TakeItemCommandSchema } from './takeItem.js';
// takeNext: put the item under a rundown's cursor on air.
export { type TakeNextCommand, TakeNextCommandSchema } from './takeNext.js';
// moveItemToHome: move an item to a rundown or a panel (or within its own), at a position.
export { type MoveItemToHomeCommand, MoveItemToHomeCommandSchema } from './moveItemToHome.js';
