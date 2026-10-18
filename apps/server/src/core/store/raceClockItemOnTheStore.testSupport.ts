// Test support: the race clock prepared as an item through a real store, for the store,
// HTTP and WebSocket tests that need "a take". Since BAJAOVRLAY-37 everything on air
// comes from an item (the old takeGraphic command is gone), so a test first creates the
// item with createItem and then sends takeItem for the id the store answered with.
// Every function builds fresh objects on each call, so no test can change what another
// one sees.
import type { ItemFields, ItemHome } from '@bajaovrlay/shared';

import type { StateStore } from './createStateStore.js';

/** The actor an item is created as unless the test names another: the operator's page. */
const operatorWhoPreparesTheItem = 'operador:conexao-7';

/**
 * Builds the race clock data of the enduro under green flag, 1:05:00 in and running: all
 * six fields the race clock's manifest schema requires, so a take of it is accepted.
 */
export function buildGreenFlagEnduroClockData(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_550_800_000,
    running: true,
  };
}

/**
 * Turns graphic data into item fields, each value typed in by the operator (`literal`),
 * so a take of the item puts exactly that data on air.
 */
export function buildLiteralItemFieldsFromData(data: Record<string, unknown>): ItemFields {
  const fields: ItemFields = {};
  for (const [fieldKey, value] of Object.entries(data)) {
    fields[fieldKey] = { kind: 'literal', value };
  }
  return fields;
}

/** The home of an item in the main session the server seeds, "Sessão principal". */
export const mainSessionHome: ItemHome = { kind: 'rundown', rundownId: 'sessao-principal' };

/**
 * The home of a button of the quick-fire panel the server seeds, "Atalhos". A take of
 * such an item never moves a rundown cursor, so it changes only the instances and the
 * event log.
 */
export const shortcutsPanelHome: ItemHome = { kind: 'quickFire', panelId: 'atalhos' };

/**
 * Builds the createItem command for a race clock item with the given fields and label,
 * on the given layer, in the given home.
 */
export function buildCreateRaceClockItemCommand(
  fields: ItemFields,
  label: string,
  layerId: string,
  home: ItemHome,
) {
  return {
    type: 'createItem',
    home,
    graphicId: 'race-clock',
    layerId,
    fields,
    label,
  };
}

/**
 * Sends the given createItem command to the store (as the operator unless another actor
 * is named) and returns the id the store gave the new item. Throws when the store
 * refuses it, so a broken Arrange step fails loudly, not later.
 */
export function createItemOnTheStore(
  store: StateStore,
  createItemCommand: Record<string, unknown>,
  actor: string = operatorWhoPreparesTheItem,
): string {
  const outcome = store.applyCommand(createItemCommand, actor);
  if (!outcome.ok || outcome.createdItemId === undefined) {
    throw new Error(
      `The item "${String(createItemCommand.label)}" was not created: ${JSON.stringify(outcome)}`,
    );
  }
  return outcome.createdItemId;
}

/**
 * Creates a race clock item on the store and returns the id the store gave it. Without
 * options it is "Relógio do enduro" on the clock layer of the main session, holding the
 * green flag enduro data, created by `operador:conexao-7`.
 */
export function createRaceClockItemOnTheStore(
  store: StateStore,
  options: {
    fields?: ItemFields;
    label?: string;
    layerId?: string;
    home?: ItemHome;
    actor?: string;
  } = {},
): string {
  const fields = options.fields ?? buildLiteralItemFieldsFromData(buildGreenFlagEnduroClockData());
  const label = options.label ?? 'Relógio do enduro';
  const layerId = options.layerId ?? 'clock';
  const home = options.home ?? mainSessionHome;
  return createItemOnTheStore(
    store,
    buildCreateRaceClockItemCommand(fields, label, layerId, home),
    options.actor ?? operatorWhoPreparesTheItem,
  );
}
