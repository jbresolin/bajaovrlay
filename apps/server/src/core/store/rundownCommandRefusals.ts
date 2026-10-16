// The refusals of the rundown and item commands, each with its stable code and pt-BR
// message. They sit beside commandRefusals.ts (the refusals of every other command)
// rather than inside it only to keep BAJAOVRLAY-13 out of a file BAJAOVRLAY-12 rewrites;
// the two files can become one once both tasks are merged.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/** The refusal for a command naming an item that does not exist (or was deleted). */
export function refuseUnknownItem(itemId: string): CommandError {
  return { code: 'ITEM_NOT_FOUND', message: ptBR.rundownCommandErrors.itemNotFound(itemId) };
}

/** The refusal for a command naming a rundown that does not exist. */
export function refuseUnknownRundown(rundownId: string): CommandError {
  return {
    code: 'RUNDOWN_NOT_FOUND',
    message: ptBR.rundownCommandErrors.rundownNotFound(rundownId),
  };
}

/** The refusal for moving a rundown's cursor to an item that lives in another rundown. */
export function refuseItemOfAnotherRundown(itemLabel: string, rundownName: string): CommandError {
  return {
    code: 'ITEM_NOT_IN_RUNDOWN',
    message: ptBR.rundownCommandErrors.itemNotInRundown(itemLabel, rundownName),
  };
}

/** The refusal for moving a rundown's cursor to a quick-fire panel button. */
export function refuseQuickFireButtonAsCursor(
  itemLabel: string,
  rundownName: string,
): CommandError {
  return {
    code: 'ITEM_NOT_IN_RUNDOWN',
    message: ptBR.rundownCommandErrors.itemIsAQuickFireButton(itemLabel, rundownName),
  };
}

/** The refusal for a new order that is not exactly the rundown's items, once each. */
export function refuseOrderThatIsNotAPermutation(rundownName: string): CommandError {
  return {
    code: 'ITEMS_NOT_A_PERMUTATION',
    message: ptBR.rundownCommandErrors.itemsNotAPermutation(rundownName),
  };
}

/** The refusal for "take the next item" when the rundown's cursor is on nothing. */
export function refuseTakeWithEmptyCursor(rundownName: string): CommandError {
  return {
    code: 'RUNDOWN_CURSOR_EMPTY',
    message: ptBR.rundownCommandErrors.rundownCursorEmpty(rundownName),
  };
}

/**
 * The refusal for an item field whose value is of a kind the server cannot resolve
 * yet (bindings and entities arrive in M2); the message names the field, the kind and M2.
 * `literal` and `takeTime` are resolved today and never get this refusal.
 */
export function refuseUnsupportedFieldKind(fieldKey: string, fieldKind: string): CommandError {
  return {
    code: 'UNSUPPORTED_FIELD_KIND',
    message: ptBR.rundownCommandErrors.unsupportedFieldKind(fieldKey, fieldKind),
  };
}
