// The history sentences of the commands that prepare the show: items, rundowns, quick-fire
// panels, macros (BAJAOVRLAY-30) and the triggers that run them (BAJAOVRLAY-48). One named formatter per command type, gathered in
// sentenceOfEachCommandType.ts.
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import {
  nameInstance,
  nameItem,
  nameItemHomeAsDestination,
  nameItemHomeAsPlace,
  nameMacro,
  nameQuickFirePanel,
  nameRundown,
  nameTrigger,
} from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

const sentences = ptBREventLogReading.itemsAndRundown;

/** createItem: the label it was given, and where it was put. */
export function describeCreateItem(
  command: CommandOfType<'createItem'>,
  names: EventLogNames,
): string {
  return sentences.createdItem(command.label, nameItemHomeAsPlace(command.home, names));
}

/** updateItemFields ("Salvar" in the item editor). */
export function describeUpdateItemFields(
  command: CommandOfType<'updateItemFields'>,
  names: EventLogNames,
): string {
  return sentences.editedItem(nameItem(command.itemId, names));
}

/** deleteItem: the item reads "item excluído (…)" once it is gone, which it is. */
export function describeDeleteItem(
  command: CommandOfType<'deleteItem'>,
  names: EventLogNames,
): string {
  return sentences.deletedItem(nameItem(command.itemId, names));
}

/** reorderItems: a rundown's rows dragged into a new order. */
export function describeReorderItems(
  command: CommandOfType<'reorderItems'>,
  names: EventLogNames,
): string {
  return sentences.reorderedRundown(nameRundown(command.rundownId, names));
}

/** moveCursor: the arrows or a click on a row, or past the last row. */
export function describeMoveCursor(
  command: CommandOfType<'moveCursor'>,
  names: EventLogNames,
): string {
  const rundownName = nameRundown(command.rundownId, names);
  if (command.itemId === null) {
    return sentences.movedCursorToTheEnd(rundownName);
  }
  return sentences.movedCursorToItem(rundownName, nameItem(command.itemId, names));
}

/** moveItemToHome ("Mover para rundown", or to a panel). */
export function describeMoveItemToHome(
  command: CommandOfType<'moveItemToHome'>,
  names: EventLogNames,
): string {
  return sentences.movedItemToHome(
    nameItem(command.itemId, names),
    nameItemHomeAsDestination(command.home, names),
  );
}

/** saveOnAirChangesIntoItem ("Salvar no item"). */
export function describeSaveOnAirChangesIntoItem(
  command: CommandOfType<'saveOnAirChangesIntoItem'>,
  names: EventLogNames,
): string {
  return sentences.savedOnAirChanges(nameInstance(command.instanceId, names));
}

/** createQuickFirePanel ("+ Painel"). */
export function describeCreateQuickFirePanel(
  command: CommandOfType<'createQuickFirePanel'>,
): string {
  return sentences.createdPanel(command.name);
}

/** renameQuickFirePanel: the panel by its name now, which is already the new one. */
export function describeRenameQuickFirePanel(
  command: CommandOfType<'renameQuickFirePanel'>,
  names: EventLogNames,
): string {
  return sentences.renamedPanel(nameQuickFirePanel(command.panelId, names), command.name);
}

/** deleteQuickFirePanel. */
export function describeDeleteQuickFirePanel(
  command: CommandOfType<'deleteQuickFirePanel'>,
  names: EventLogNames,
): string {
  return sentences.deletedPanel(nameQuickFirePanel(command.panelId, names));
}

/** createMacro. */
export function describeCreateMacro(command: CommandOfType<'createMacro'>): string {
  return sentences.createdMacro(command.label);
}

/** updateMacro (the macro editor's "Salvar"). */
export function describeUpdateMacro(
  command: CommandOfType<'updateMacro'>,
  names: EventLogNames,
): string {
  return sentences.editedMacro(nameMacro(command.macroId, names));
}

/** deleteMacro. */
export function describeDeleteMacro(
  command: CommandOfType<'deleteMacro'>,
  names: EventLogNames,
): string {
  return sentences.deletedMacro(nameMacro(command.macroId, names));
}

/** createTrigger ("+ Gatilho" on Gatilhos): the name it was given. */
export function describeCreateTrigger(command: CommandOfType<'createTrigger'>): string {
  return sentences.createdTrigger(command.name);
}

/** updateTrigger ("Salvar gatilho", or its on/off switch). */
export function describeUpdateTrigger(
  command: CommandOfType<'updateTrigger'>,
  names: EventLogNames,
): string {
  return sentences.editedTrigger(nameTrigger(command.triggerId, names));
}

/** deleteTrigger. */
export function describeDeleteTrigger(
  command: CommandOfType<'deleteTrigger'>,
  names: EventLogNames,
): string {
  return sentences.deletedTrigger(nameTrigger(command.triggerId, names));
}

/** setTriggersPaused: "Pausar gatilhos" in the header, turned on or off. */
export function describeSetTriggersPaused(command: CommandOfType<'setTriggersPaused'>): string {
  return command.isPaused ? sentences.pausedTriggers : sentences.resumedTriggers;
}
