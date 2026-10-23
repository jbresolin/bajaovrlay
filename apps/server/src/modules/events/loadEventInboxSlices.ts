import {
  type EventRule,
  type InboxEvent,
  type Item,
  type QuickFirePanel,
  SlicesSchema,
} from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { addSeededEventPanelAndItems } from './seedEventItems.js';
import { seededEventRules } from './seedEventRules.js';

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
 * it, so an installation gets a new kind's rule without a new database. A row that fails
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
    );
    logger.info('no stored event rules row; seeded the default rules and the panel "Avisos"');
    return { events, eventRules: seededEventRules, ...panelsAndItemsAfter, rowsToSaveAtBoot };
  }

  const storedRules = SlicesSchema.shape.eventRules.parse(rulesRow.json);
  const rulesMissing = seededEventRules.filter(
    (seededRule) => !storedRules.some((storedRule) => storedRule.kind === seededRule.kind),
  );
  if (rulesMissing.length === 0) {
    return { events, eventRules: storedRules, ...panelsAndItems, rowsToSaveAtBoot };
  }
  const eventRules = [...storedRules, ...rulesMissing];
  rowsToSaveAtBoot.push({ name: 'eventRules', json: eventRules, updatedAt });
  logger.info(
    { added_kinds: rulesMissing.map((rule) => rule.kind) },
    'seeded event rules missing from the stored rules were added',
  );
  return { events, eventRules, ...panelsAndItems, rowsToSaveAtBoot };
}
