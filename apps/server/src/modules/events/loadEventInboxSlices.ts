import {
  type EventRule,
  type InboxEvent,
  type Item,
  type QuickFirePanel,
  SlicesSchema,
} from '@bajaovrlay/shared';
import { z } from 'zod';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import {
  addSeededEventPanelAndItems,
  addSeededSuperChatItemToAnOlderDatabase,
} from './seedEventItems.js';
import { seededEventRules } from './seedEventRules.js';

/**
 * The row that remembers which of the inbox's later seeds a database has had, so each runs
 * once (gate 2 of PR #54): a seed that only looked at the slices would come back after an
 * operator undid it in a way that looks like a database that never had it. Not a slice:
 * no page receives it, and every other boot step ignores a row it does not read.
 */
export const eventInboxSeedsAppliedRowName = 'eventInboxSeedsApplied';

/** The seed of the "Super Chat" item and its rule's item (BAJAOVRLAY-35). */
const superChatItemSeedName = 'superChatItem';

// The marker row's content: the names of the seeds applied.
const SeedsAppliedSchema = z.array(z.string().min(1));

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
};

/**
 * Reads the `events` and `eventRules` slices from the stored rows. The events start empty
 * on a database written before the inbox; the rules are seeded when their row is missing
 * (a first boot, or such a database), together with the "Avisos" panel and its two
 * notice items the rules name (seedEventItems.ts), once: a panel the operator deletes
 * later is not brought back. A kind seeded since the rules row was written is added to
 * it, so an installation gets a new kind's rule without a new database; and a database
 * seeded before BAJAOVRLAY-35 gets the "Super Chat" item once, when its rule still has no
 * item (addSeededSuperChatItemToAnOlderDatabase), the row eventInboxSeedsApplied keeping
 * that it was considered. A row that fails
 * its schema stops the boot, as the items row does: a wrong rule could put things on air
 * by itself.
 */
export function loadOrSeedEventInboxSlices(
  storedRows: SliceRow[],
  panelsAndItems: PanelsAndItemsAtBoot,
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
      { name: eventInboxSeedsAppliedRowName, json: [superChatItemSeedName], updatedAt },
    );
    logger.info('no stored event rules row; seeded the default rules and the panel "Avisos"');
    return { events, eventRules: seededEventRules, ...panelsAndItemsAfter, rowsToSaveAtBoot };
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

  const seedsApplied = SeedsAppliedSchema.parse(
    storedRows.find((row) => row.name === eventInboxSeedsAppliedRowName)?.json ?? [],
  );
  if (seedsApplied.includes(superChatItemSeedName)) {
    return { events, eventRules, ...panelsAndItems, rowsToSaveAtBoot };
  }
  // Considered once, whatever comes of it: an operator's own choice is never revisited.
  rowsToSaveAtBoot.push({
    name: eventInboxSeedsAppliedRowName,
    json: [...seedsApplied, superChatItemSeedName],
    updatedAt,
  });
  const withTheSuperChatItem = addSeededSuperChatItemToAnOlderDatabase(
    eventRules,
    panelsAndItems.quickFirePanels,
    panelsAndItems.items,
  );
  if (withTheSuperChatItem === undefined) {
    return { events, eventRules, ...panelsAndItems, rowsToSaveAtBoot };
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
  };
}
