/**
 * What the server stores for an item once it accepted an `updateItemFields` from the
 * editor: the item as the editor knew it, with the parts that save carried. A pure
 * function, no drawing.
 *
 * Why the editor needs it: a save can be accepted while the editor stays open (the
 * on-air update of "Atualizar no ar" was refused). The next press must then be compared
 * with what was just saved. Compared with the item as it was when the editor opened, a
 * field the operator puts back would look untouched, nothing would be sent, and the
 * server would keep the value the operator gave up on.
 *
 * Deliberate trade-off: this repeats, on the page, the merge the server does. It is
 * worked out here instead of taking the newer item from the server's slice, because that
 * copy also carries what OTHER operators changed meanwhile, and the editor must not send
 * those parts back with the old values its form still shows.
 * What could go wrong: if the server's merge of this command changes, this must follow.
 */
import type { Item, UpdateItemFieldsCommand } from '@bajaovrlay/shared';

/**
 * Builds the item as the server stores it after accepting `acceptedSave`, starting from
 * `storedItem` (what it stored before, as far as the editor knows). `storedItem` itself
 * is left as it was.
 */
export function buildStoredItemAfterAcceptedSave(
  storedItem: Item,
  acceptedSave: UpdateItemFieldsCommand,
): Item {
  const itemAfterTheSave: Item = { ...storedItem };

  if (acceptedSave.layerId !== undefined) {
    itemAfterTheSave.layerId = acceptedSave.layerId;
  }
  if (acceptedSave.label !== undefined) {
    itemAfterTheSave.label = acceptedSave.label;
  }
  if (acceptedSave.color !== undefined) {
    itemAfterTheSave.color = acceptedSave.color;
  }
  if (acceptedSave.notes !== undefined) {
    itemAfterTheSave.notes = acceptedSave.notes;
  }

  // Null is how the command says "no auto-out any more". The key is removed, not set to
  // undefined, so the item reads exactly like one that never had an auto-out.
  if (acceptedSave.autoOutAfterMs === null) {
    delete itemAfterTheSave.autoOutAfterMs;
  }
  if (typeof acceptedSave.autoOutAfterMs === 'number') {
    itemAfterTheSave.autoOutAfterMs = acceptedSave.autoOutAfterMs;
  }

  // The command replaces the fields it names and keeps the others, key by key. A cleared
  // field arrives as a literal null and is stored as that, as the server stores it.
  if (acceptedSave.fields !== undefined) {
    itemAfterTheSave.fields = { ...storedItem.fields, ...acceptedSave.fields };
  }

  return itemAfterTheSave;
}
