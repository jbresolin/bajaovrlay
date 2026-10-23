import { type EventRule, type InboxEvent, SlicesSchema } from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { seededEventRules } from './seedEventRules.js';

/** The inbox slices a boot starts with, and the rows it must still save. */
export type EventInboxSlicesAtBoot = {
  events: InboxEvent[];
  eventRules: EventRule[];
  /** The rules row, when it was missing or a kind had to be added to it. */
  rowsToSaveAtBoot: SliceRow[];
};

/**
 * Reads the `events` and `eventRules` slices from the stored rows. The events start empty
 * on a database written before the inbox; the rules are seeded when their row is missing
 * (a first boot, or such a database), and a kind seeded since the row was written is
 * added to it, so an installation gets a new kind's rule without a new database. A row
 * that fails its schema stops the boot, as the items row does: a wrong rule could put
 * things on air by itself.
 */
export function loadOrSeedEventInboxSlices(
  storedRows: SliceRow[],
  updatedAt: string,
  logger: ServerLogger,
): EventInboxSlicesAtBoot {
  const rowsToSaveAtBoot: SliceRow[] = [];
  const events = SlicesSchema.shape.events.parse(
    storedRows.find((row) => row.name === 'events')?.json ?? [],
  );

  const rulesRow = storedRows.find((row) => row.name === 'eventRules');
  if (rulesRow === undefined) {
    rowsToSaveAtBoot.push({ name: 'eventRules', json: seededEventRules, updatedAt });
    logger.info('no stored event rules row; seeded the default rules');
    return { events, eventRules: seededEventRules, rowsToSaveAtBoot };
  }

  const storedRules = SlicesSchema.shape.eventRules.parse(rulesRow.json);
  const rulesMissing = seededEventRules.filter(
    (seededRule) => !storedRules.some((storedRule) => storedRule.kind === seededRule.kind),
  );
  if (rulesMissing.length === 0) {
    return { events, eventRules: storedRules, rowsToSaveAtBoot };
  }
  const eventRules = [...storedRules, ...rulesMissing];
  rowsToSaveAtBoot.push({ name: 'eventRules', json: eventRules, updatedAt });
  logger.info(
    { added_kinds: rulesMissing.map((rule) => rule.kind) },
    'seeded event rules missing from the stored rules were added',
  );
  return { events, eventRules, rowsToSaveAtBoot };
}
