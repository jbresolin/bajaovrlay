import {
  type EventRule,
  type InboxEvent,
  type Item,
  type QuickFirePanel,
  SlicesSchema,
} from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { ptBR } from '../../core/messages/ptBR.js';
import {
  eventTemplatesOffQuickFireSeedName,
  moveEventTemplatesOffQuickFire,
} from './moveEventTemplatesOffQuickFire.js';
import {
  addSeededEventTemplates,
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
   * and items rows when the templates were seeded or moved off the panels.
   */
  rowsToSaveAtBoot: SliceRow[];
  /** The seeds this boot considered for the first time, for the boot to record as done. */
  seedNamesDoneAtBoot: string[];
};

/**
 * Reads the `events` and `eventRules` slices from the stored rows. The events start empty
 * on a database written before the inbox; the rules are seeded when their row is missing
 * (a first boot, or such a database), together with the three templates the rules name,
 * in "Modelos de evento" (seedEventItems.ts), once: a template the operator deletes later
 * is not brought back. A kind seeded since the rules row was written is added to it, so an
 * installation gets a new kind's rule without a new database. Then two one-off steps, each
 * remembered in `seeds_done`: a database seeded before BAJAOVRLAY-35 gets the "Super Chat"
 * item when its rule still has no item (addSeededSuperChatItemToAnOlderDatabase); and a
 * database written before BAJAOVRLAY-67 has its templates taken off the quick-fire panels
 * (moveEventTemplatesOffQuickFire), after the Super Chat seed, which still adds to "Avisos".
 * A row that fails its schema stops the boot, as the items row does: a wrong rule could put
 * things on air by itself.
 */
export function loadOrSeedEventInboxSlices(
  storedRows: SliceRow[],
  panelsAndItems: PanelsAndItemsAtBoot,
  seedNamesDone: string[],
  updatedAt: string,
  logger: ServerLogger,
): EventInboxSlicesAtBoot {
  const events = SlicesSchema.shape.events.parse(
    storedRows.find((row) => row.name === 'events')?.json ?? [],
  );

  const rulesRow = storedRows.find((row) => row.name === 'eventRules');
  if (rulesRow === undefined) {
    const itemsAfter = addSeededEventTemplates(panelsAndItems.items);
    logger.info('no stored event rules row; seeded the default rules and the event templates');
    return {
      events,
      eventRules: seededEventRules,
      quickFirePanels: panelsAndItems.quickFirePanels,
      items: itemsAfter,
      rowsToSaveAtBoot: [
        { name: 'eventRules', json: seededEventRules, updatedAt },
        { name: 'items', json: itemsAfter, updatedAt },
      ],
      // A database seeded now has its templates where they belong: neither step applies.
      seedNamesDoneAtBoot: [superChatItemSeedName, eventTemplatesOffQuickFireSeedName],
    };
  }

  const storedRules = SlicesSchema.shape.eventRules.parse(rulesRow.json);
  const rulesMissing = seededEventRules.filter(
    (seededRule) => !storedRules.some((storedRule) => storedRule.kind === seededRule.kind),
  );
  let eventRules = storedRules;
  if (rulesMissing.length > 0) {
    eventRules = [...storedRules, ...rulesMissing];
    logger.info(
      { added_kinds: rulesMissing.map((rule) => rule.kind) },
      'seeded event rules missing from the stored rules were added',
    );
  }
  let isTheRulesRowChanged = rulesMissing.length > 0;
  let items = panelsAndItems.items;
  let quickFirePanels = panelsAndItems.quickFirePanels;
  let isTheItemsRowChanged = false;
  let isThePanelsRowChanged = false;
  const seedNamesDoneAtBoot: string[] = [];

  if (!seedNamesDone.includes(superChatItemSeedName)) {
    // Considered once, whatever comes of it: an operator's own choice is never revisited.
    seedNamesDoneAtBoot.push(superChatItemSeedName);
    const withTheSuperChatItem = addSeededSuperChatItemToAnOlderDatabase(
      eventRules,
      quickFirePanels,
      items,
    );
    if (withTheSuperChatItem !== undefined) {
      eventRules = withTheSuperChatItem.eventRules;
      items = withTheSuperChatItem.items;
      isTheRulesRowChanged = true;
      isTheItemsRowChanged = true;
      logger.info('seeded the "Super Chat" item and named it in the Super Chat rule');
    }
  }

  if (!seedNamesDone.includes(eventTemplatesOffQuickFireSeedName)) {
    seedNamesDoneAtBoot.push(eventTemplatesOffQuickFireSeedName);
    const moveOutcome = moveEventTemplatesOffQuickFire(quickFirePanels, items);
    if (moveOutcome.isAnythingMoved) {
      isThePanelsRowChanged = moveOutcome.quickFirePanels !== quickFirePanels;
      quickFirePanels = moveOutcome.quickFirePanels;
      items = moveOutcome.items;
      isTheItemsRowChanged = true;
      logger.info(
        { panels_after: quickFirePanels.map((panel) => panel.id) },
        'moved the event templates off the quick-fire panels into "Modelos de evento"',
      );
      // A pad finds a button by its place: the move cannot fix the pads, so it says which
      // buttons moved, in pt-BR, for the operator to check (gate 2 of PR #58).
      for (const button of moveOutcome.buttonsShifted) {
        logger.warn(
          {
            shifted_button: {
              panel_id: button.panelId,
              item_id: button.itemId,
              place_before: button.placeBefore,
              place_after: button.placeAfter,
            },
          },
          ptBR.eventErrors.quickFireButtonShiftedByTheTemplateMove(button),
        );
      }
    }
  }

  const rowsToSaveAtBoot: SliceRow[] = [];
  if (isTheRulesRowChanged) {
    rowsToSaveAtBoot.push({ name: 'eventRules', json: eventRules, updatedAt });
  }
  if (isTheItemsRowChanged) {
    rowsToSaveAtBoot.push({ name: 'items', json: items, updatedAt });
  }
  if (isThePanelsRowChanged) {
    rowsToSaveAtBoot.push({ name: 'quickFirePanels', json: quickFirePanels, updatedAt });
  }
  return { events, eventRules, quickFirePanels, items, rowsToSaveAtBoot, seedNamesDoneAtBoot };
}
