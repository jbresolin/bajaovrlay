import type { Item, Layer, Macro, QuickFirePanel, Trigger } from '@bajaovrlay/shared';

import type { SliceRow } from '../db/tables.js';
import type { ServerLogger } from '../logger/createLogger.js';
import { ptBR } from '../messages/ptBR.js';

/** The name the plain sponsor roll's seed is recorded under in `seeds_done`. */
export const plainSponsorRollSeedName = 'plainSponsorRoll';

/** The seeded ids, fixed and readable like the other seeded ids. */
const plainSponsorRollPanelId = 'patrocinadores';
const plainSponsorRollItemId = 'patrocinadores-simples';
const plainSponsorRollMacroId = 'patrocinadores-simples';
const sponsorsEvery30MinutesTriggerId = 'patrocinadores-a-cada-30-min';

/** The layer the roll goes on: the sponsor bug's, whose footprint its card fits. */
const plainSponsorRollLayerId = 'bug';

/**
 * The item on the plain sponsor roll: every sponsor of Cadastros (the entity list the
 * sponsor roll's items read), top-left, the sponsor bug's corner, on the bug's layer.
 */
function buildPlainSponsorRollItem(order: number): Item {
  return {
    id: plainSponsorRollItemId,
    home: { kind: 'quickFire', panelId: plainSponsorRollPanelId },
    order,
    graphicId: 'sponsor-roll-plain',
    layerId: plainSponsorRollLayerId,
    label: ptBR.seededPlainSponsorRoll.itemLabel,
    color: 'neutral',
    notes: '',
    fields: {
      sponsors: { kind: 'entityList', entityType: 'sponsor' },
      corner: { kind: 'literal', value: 'top-left' },
    },
  };
}

/** The macro that takes the item: what the trigger runs. */
function buildPlainSponsorRollMacro(): Macro {
  return {
    id: plainSponsorRollMacroId,
    label: ptBR.seededPlainSponsorRoll.macroLabel,
    color: 'neutral',
    steps: [{ kind: 'takeItem', itemId: plainSponsorRollItemId }],
  };
}

/**
 * The trigger every 30 minutes, all day. Off and asking, so nothing goes on air by surprise
 * until the operator switches it on (the count then starts from that moment); 10 s
 * between firings, the default of every new trigger.
 */
function buildSponsorsEvery30MinutesTrigger(): Trigger {
  return {
    id: sponsorsEvery30MinutesTriggerId,
    name: ptBR.seededPlainSponsorRoll.triggerName,
    isEnabled: false,
    when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 30, window: null } },
    macroId: plainSponsorRollMacroId,
    mode: 'ask',
    minimumIntervalMs: 10_000,
  };
}

/** The panels, items, macros and triggers after the seed, and what the boot must do. */
export type PlainSponsorRollSeedOutcome = {
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  macros: Macro[];
  triggers: Trigger[];
  /** False when the seed was already done here: nothing changed, nothing to write. */
  isSeedApplied: boolean;
  /** True when nothing could be added: the operator deleted the bug layer. */
  isBugLayerMissing: boolean;
};

/** The panels with the "Patrocinadores" panel after the last one, unless it is there already. */
function addPlainSponsorRollPanelAfterTheLast(quickFirePanels: QuickFirePanel[]): QuickFirePanel[] {
  const isPanelThere = quickFirePanels.some((panel) => panel.id === plainSponsorRollPanelId);
  if (isPanelThere) {
    return quickFirePanels;
  }
  const lastOrder = Math.max(-1, ...quickFirePanels.map((panel) => panel.order));
  const plainSponsorRollPanel: QuickFirePanel = {
    id: plainSponsorRollPanelId,
    name: ptBR.seededPlainSponsorRoll.panelName,
    order: lastOrder + 1,
  };
  return [...quickFirePanels, plainSponsorRollPanel];
}

/**
 * Adds the "Patrocinadores" panel after the last one, the "Patrocinadores (simples)" item
 * as its only button, the macro that takes it and the trigger that runs the macro, once per
 * database: nothing when `seeds_done` already names the seed. Any of them already there is
 * kept as it is. When the operator deleted the bug layer none is added, since the item would
 * have no layer to go on; the seed counts as applied all the same, so it is never tried again.
 *
 * Deliberate (following João's ruling for the channel logo, gate 2 of PR #56): a panel of
 * its own, so the roll never takes a button of "Atalhos" from the operator's own, and never
 * the rundown, whose first item must stay the operator's to get the cursor.
 */
export function addPlainSponsorRollItemMacroAndTriggerOnce(options: {
  seedNamesDone: string[];
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  macros: Macro[];
  triggers: Trigger[];
}): PlainSponsorRollSeedOutcome {
  const unchanged = {
    quickFirePanels: options.quickFirePanels,
    items: options.items,
    macros: options.macros,
    triggers: options.triggers,
  };
  if (options.seedNamesDone.includes(plainSponsorRollSeedName)) {
    return { ...unchanged, isSeedApplied: false, isBugLayerMissing: false };
  }
  const isBugLayerThere = options.layers.some((layer) => layer.id === plainSponsorRollLayerId);
  if (!isBugLayerThere) {
    return { ...unchanged, isSeedApplied: true, isBugLayerMissing: true };
  }

  let quickFirePanels = options.quickFirePanels;
  let items = options.items;
  const isItemThere = items.some((item) => item.id === plainSponsorRollItemId);
  if (!isItemThere) {
    quickFirePanels = addPlainSponsorRollPanelAfterTheLast(quickFirePanels);
    const itemsOfThePanel = items.filter(
      (item) => item.home.kind === 'quickFire' && item.home.panelId === plainSponsorRollPanelId,
    );
    items = [...items, buildPlainSponsorRollItem(itemsOfThePanel.length)];
  }
  const isMacroThere = options.macros.some((macro) => macro.id === plainSponsorRollMacroId);
  const macros = isMacroThere ? options.macros : [...options.macros, buildPlainSponsorRollMacro()];
  const isTriggerThere = options.triggers.some(
    (trigger) => trigger.id === sponsorsEvery30MinutesTriggerId,
  );
  const triggers = isTriggerThere
    ? options.triggers
    : [...options.triggers, buildSponsorsEvery30MinutesTrigger()];
  return {
    quickFirePanels,
    items,
    macros,
    triggers,
    isSeedApplied: true,
    isBugLayerMissing: false,
  };
}

/**
 * The rows the plain sponsor roll's seed changed: the panels, items, macros and triggers
 * when it was applied with the bug layer there, none otherwise.
 */
export function listRowsOfThePlainSponsorRollSeed(
  plainSponsorRollSeed: PlainSponsorRollSeedOutcome,
  updatedAt: string,
): SliceRow[] {
  if (!plainSponsorRollSeed.isSeedApplied || plainSponsorRollSeed.isBugLayerMissing) {
    return [];
  }
  return [
    { name: 'quickFirePanels', json: plainSponsorRollSeed.quickFirePanels, updatedAt },
    { name: 'items', json: plainSponsorRollSeed.items, updatedAt },
    { name: 'macros', json: plainSponsorRollSeed.macros, updatedAt },
    { name: 'triggers', json: plainSponsorRollSeed.triggers, updatedAt },
  ];
}

/** Says what the plain sponsor roll's seed did, once: an info line, or a warning. */
export function logPlainSponsorRollSeed(
  plainSponsorRollSeed: PlainSponsorRollSeedOutcome,
  logger: ServerLogger,
): void {
  if (!plainSponsorRollSeed.isSeedApplied) {
    return;
  }
  if (plainSponsorRollSeed.isBugLayerMissing) {
    logger.warn(
      'the "Patrocinadores (simples)" item, macro and trigger were not seeded: the bug layer is gone',
    );
    return;
  }
  logger.info('seeded the "Patrocinadores (simples)" item, macro and trigger');
}
