import {
  type EventRule,
  type InboxEvent,
  type Item,
  type QuickFirePanel,
  SlicesSchema,
} from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import {
  addSeededEventPanelAndItems,
  addSeededSuperChatItemToAnOlderDatabase,
} from './seedEventItems.js';
import { seededEventRules } from './seedEventRules.js';

/**
 * The name the "Super Chat" item's seed (BAJAOVRLAY-35) is recorded under in `seeds_done`,
 * the table of one-off seeds (BAJAOVRLAY-63), so it runs once (gate 2 of PR #54): a seed
 * that only looked at the slices would come back after an operator undid it in a way that
 * looks like a database that never had it.
 */
export const superChatItemSeedName = 'superChatItem';

/** The panels and items loaded before the inbox, which seeding the rules may add to. */
export type PanelsAndItemsAtBoot = { quickFirePanels: QuickFirePanel[]; items: Item[] };

/** The inbox slices a boot starts with, the panels and items after it, and its rows. */
export type EventInboxSlicesAtBoot = PanelsAndItemsAtBoot & {
  events: InboxEvent[];
  eventRules: EventRule[];
  /**
   * The rules row, when it was missing or a kind had to be added to it, and the panels
   * and items rows when the "Avisos" panel and its items were seeded with the rules.
   */
  rowsToSaveAtBoot: SliceRow[];
  /** The seeds this boot considered for the first time, for the boot to record as done. */
  seedNamesDoneAtBoot: string[];
};

/**
 * Reads the `events` and `eventRules` slices from the stored rows. The events start empty
 * on a database written before the inbox; the rules are seeded when their row is missing
 * (a first boot, or such a database), together with the "Avisos" panel and its two
 * notice items the rules name (seedEventItems.ts), once: a panel the operator deletes
 * later is not brought back. A kind seeded since the rules row was written is added to
 * it, so an installation gets a new kind's rule without a new database; and a database
 * seeded before BAJAOVRLAY-35 gets the "Super Chat" item once, when its rule still has no
 * item (addSeededSuperChatItemToAnOlderDatabase), `seeds_done` keeping that it was
 * considered. A row that fails
 * its schema stops the boot, as the items row does: a wrong rule could put things on air
 * by itself.
 */
export function loadOrSeedEventInboxSlices(
  storedRows: SliceRow[],
  panelsAndItems: PanelsAndItemsAtBoot,
  seedNamesDone: string[],
  updatedAt: string,
  logger: ServerLogger,
): EventInboxSlicesAtBoot {
  const rowsToSaveAtBoot: SliceRow[] = [];
  const events = SlicesSchema.shape.events.parse(
    storedRows.find((row) => row.name === 'events')?.json ?? [],
  );

  const rulesRow = storedRows.find((row) => row.name === 'eventRules');
  if (rulesRow === undefined) {
    const panelsAndItemsAfter = addSeededEventPanelAndItems(
      panelsAndItems.quickFirePanels,
      panelsAndItems.items,
    );
    rowsToSaveAtBoot.push(
      { name: 'eventRules', json: seededEventRules, updatedAt },
      { name: 'quickFirePanels', json: panelsAndItemsAfter.quickFirePanels, updatedAt },
      { name: 'items', json: panelsAndItemsAfter.items, updatedAt },
    );
    logger.info('no stored event rules row; seeded the default rules and the panel "Avisos"');
    return {
      events,
      eventRules: seededEventRules,
      ...panelsAndItemsAfter,
      rowsToSaveAtBoot,
      seedNamesDoneAtBoot: [superChatItemSeedName],
    };
  }

  const storedRules = SlicesSchema.shape.eventRules.parse(rulesRow.json);
  const rulesMissing = seededEventRules.filter(
    (seededRule) => !storedRules.some((storedRule) => storedRule.kind === seededRule.kind),
  );
  let eventRules = storedRules;
  if (rulesMissing.length > 0) {
    eventRules = [...storedRules, ...rulesMissing];
    rowsToSaveAtBoot.push({ name: 'eventRules', json: eventRules, updatedAt });
    logger.info(
      { added_kinds: rulesMissing.map((rule) => rule.kind) },
      'seeded event rules missing from the stored rules were added',
    );
  }

  if (seedNamesDone.includes(superChatItemSeedName)) {
    return { events, eventRules, ...panelsAndItems, rowsToSaveAtBoot, seedNamesDoneAtBoot: [] };
  }
  // Considered once, whatever comes of it: an operator's own choice is never revisited.
  const seedNamesDoneAtBoot = [superChatItemSeedName];
  const withTheSuperChatItem = addSeededSuperChatItemToAnOlderDatabase(
    eventRules,
    panelsAndItems.quickFirePanels,
    panelsAndItems.items,
  );
  if (withTheSuperChatItem === undefined) {
    return { events, eventRules, ...panelsAndItems, rowsToSaveAtBoot, seedNamesDoneAtBoot };
  }
  // A rules row already queued above is replaced by this later one: the last row wins.
  const rowsWithoutRules = rowsToSaveAtBoot.filter((row) => row.name !== 'eventRules');
  rowsWithoutRules.push(
    { name: 'eventRules', json: withTheSuperChatItem.eventRules, updatedAt },
    { name: 'items', json: withTheSuperChatItem.items, updatedAt },
  );
  logger.info('seeded the "Super Chat" item and named it in the Super Chat rule');
  return {
    events,
    eventRules: withTheSuperChatItem.eventRules,
    quickFirePanels: panelsAndItems.quickFirePanels,
    items: withTheSuperChatItem.items,
    rowsToSaveAtBoot: rowsWithoutRules,
    seedNamesDoneAtBoot,
  };
}
