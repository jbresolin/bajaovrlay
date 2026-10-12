/**
 * Every item the server may be storing for the item in the editor, as far as the editor
 * can know from the answers to its own saves. Pure functions, no drawing.
 *
 * Why the editor needs it: it sends only what differs from the stored item. After a save
 * the server never answered (the 5-second timeout) the save may have been applied or
 * lost, so there are two items the server may store. The editor then sends every part in
 * which the form differs from EITHER, so a value put back after an unanswered save is
 * saved again instead of the server keeping the value the operator gave up on.
 *
 * Deliberate trade-off: after an unanswered save a later press may re-send a part the
 * server already holds. That costs nothing: the server answers ok to an
 * `updateItemFields` that changes nothing, and saves and broadcasts nothing for it.
 * What could go wrong: this knows nothing of what OTHER operators saved meanwhile; that
 * is on purpose (see storedItemAfterAcceptedSave.ts).
 */
import type { Item, UpdateItemFieldsCommand } from '@bajaovrlay/shared';

import { buildStoredItemAfterAcceptedSave } from './storedItemAfterAcceptedSave';

/** What the editor knows about the stored item from the answers to its own saves. */
export type ItemsTheServerMayStore = {
  /** The item as it was when opened, plus every save of this editor the server accepted. */
  itemAfterTheAnsweredSaves: Item;
  /**
   * One item per save the server never answered since the last accepted one: what the
   * server stores if it did apply that save. Empty while every save was answered.
   */
  itemsIfAnUnansweredSaveWasApplied: Item[];
};

/** How a save ended: the server said ok, said no (or was not reachable), or said nothing. */
export type AnswerToSave = 'accepted' | 'refused' | 'leftUnanswered';

/** Lists every item the next save must be compared with, the certain one first. */
export function listEveryItemTheServerMayStore(known: ItemsTheServerMayStore): Item[] {
  return [known.itemAfterTheAnsweredSaves, ...known.itemsIfAnUnansweredSaveWasApplied];
}

/**
 * Answers what the server may store after `save` got `answerToSave`. `save` must be the
 * joined save built against every item of `knownBeforeTheSave`.
 * - accepted: one certain item again. The save carried every part in which the form
 *   differed from any of the possible items, so whichever the server stored, it now
 *   holds the form's value in each of those parts.
 * - refused: nothing changes.
 * - left unanswered: the item with the save applied becomes one more possibility.
 */
export function recordAnswerToSave(
  knownBeforeTheSave: ItemsTheServerMayStore,
  save: UpdateItemFieldsCommand,
  answerToSave: AnswerToSave,
): ItemsTheServerMayStore {
  if (answerToSave === 'refused') {
    return knownBeforeTheSave;
  }
  const itemWithTheSaveApplied = buildStoredItemAfterAcceptedSave(
    knownBeforeTheSave.itemAfterTheAnsweredSaves,
    save,
  );
  if (answerToSave === 'accepted') {
    return {
      itemAfterTheAnsweredSaves: itemWithTheSaveApplied,
      itemsIfAnUnansweredSaveWasApplied: [],
    };
  }
  return {
    itemAfterTheAnsweredSaves: knownBeforeTheSave.itemAfterTheAnsweredSaves,
    itemsIfAnUnansweredSaveWasApplied: [
      ...knownBeforeTheSave.itemsIfAnUnansweredSaveWasApplied,
      itemWithTheSaveApplied,
    ],
  };
}

/**
 * Joins the saves built from ONE form against each item the server may store into the
 * one save to send: it carries every part and every field any of them carried. Returns
 * undefined when none carried anything, so the caller sends nothing.
 * Two saves never disagree about a part's value, because every value comes from the same
 * form; they only differ in which parts they carry.
 */
export function joinSavesOfOneFormIntoOne(
  savesAgainstEachItem: Array<UpdateItemFieldsCommand | undefined>,
): UpdateItemFieldsCommand | undefined {
  let joinedSave: UpdateItemFieldsCommand | undefined = undefined;
  for (const save of savesAgainstEachItem) {
    if (save === undefined) {
      continue;
    }
    if (joinedSave === undefined) {
      joinedSave = { ...save };
      continue;
    }
    const fieldsOfBothSaves = { ...joinedSave.fields, ...save.fields };
    joinedSave = { ...joinedSave, ...save };
    // `fields` is written only when a save carried some, so a save of the label alone
    // does not gain an empty list of fields.
    const hasAnyField = Object.keys(fieldsOfBothSaves).length > 0;
    if (hasAnyField) {
      joinedSave.fields = fieldsOfBothSaves;
    }
  }
  return joinedSave;
}
