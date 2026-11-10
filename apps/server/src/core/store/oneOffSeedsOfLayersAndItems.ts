import type { Item, Layer, QuickFirePanel } from '@bajaovrlay/shared';

import type { SliceRow } from '../db/tables.js';
import type { ServerLogger } from '../logger/createLogger.js';
import {
  addBracketMatchLayerAndItemsOnce,
  bracketMatchGraphicsSeedName,
} from './seedBracketMatchGraphics.js';
import { addChannelLogoLayerAndItemOnce, channelLogoSeedName } from './seedChannelLogo.js';

/** What a seed of a layer, a panel and its items gives the boot. */
type SeedOfLayersAndItemsOutcome = {
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  isSeedApplied: boolean;
  zIndexTakenByTheOperator: number | undefined;
};

/** The layers, panels and items after the one-off seeds, and what the boot must write. */
export type OneOffSeedsOutcome = {
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  /** The layers, panels and items rows, when any seed was applied at this boot. */
  rowsToWrite: SliceRow[];
  /** The seeds applied at this boot, for `seeds_done`. */
  seedNamesApplied: string[];
};

/** The words of each seed's log lines: what it seeds, as the operator names it. */
const logLinesOfEachSeed = {
  channelLogo: {
    seeded: 'seeded the "Logo do canal" layer and item',
    notSeeded:
      'the "Logo do canal" layer and item were not seeded: a layer of the operator holds their height',
  },
  bracketMatchGraphics: {
    seeded: 'seeded the "Partida da chave" layer and the "Chave" panel',
    notSeeded:
      'the "Partida da chave" layer and the "Chave" panel were not seeded: a layer of the operator holds their height',
  },
};

/** Says in the log what one seed did, when it ran at this boot. */
function logOneSeed(
  outcome: SeedOfLayersAndItemsOutcome,
  logLines: { seeded: string; notSeeded: string },
  logger: ServerLogger,
): void {
  if (!outcome.isSeedApplied) {
    return;
  }
  if (outcome.zIndexTakenByTheOperator !== undefined) {
    logger.warn({ z_index: outcome.zIndexTakenByTheOperator }, logLines.notSeeded);
    return;
  }
  logger.info(logLines.seeded);
}

/**
 * Runs the one-off seeds of a layer with its own quick-fire panel and items, each once per
 * database (`seeds_done`), in turn: the channel logo's (BAJAOVRLAY-63, seedChannelLogo.ts)
 * and the Super Prime's match graphics' (BAJAOVRLAY-65, seedBracketMatchGraphics.ts). Each
 * reads what the one before left, so the "Chave" panel comes after "Logo". The rows are
 * written when either seed ran (one of them may be unchanged, which costs one row); each
 * seed says in the log what it did.
 */
export function applyOneOffSeedsOfLayersAndItems(options: {
  seedNamesDone: string[];
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  updatedAt: string;
  logger: ServerLogger;
}): OneOffSeedsOutcome {
  const channelLogoSeed = addChannelLogoLayerAndItemOnce(options);
  logOneSeed(channelLogoSeed, logLinesOfEachSeed.channelLogo, options.logger);
  const bracketMatchSeed = addBracketMatchLayerAndItemsOnce({
    seedNamesDone: options.seedNamesDone,
    layers: channelLogoSeed.layers,
    quickFirePanels: channelLogoSeed.quickFirePanels,
    items: channelLogoSeed.items,
  });
  logOneSeed(bracketMatchSeed, logLinesOfEachSeed.bracketMatchGraphics, options.logger);

  const seedNamesApplied: string[] = [];
  if (channelLogoSeed.isSeedApplied) {
    seedNamesApplied.push(channelLogoSeedName);
  }
  if (bracketMatchSeed.isSeedApplied) {
    seedNamesApplied.push(bracketMatchGraphicsSeedName);
  }
  const updatedAt = options.updatedAt;
  const rowsToWrite: SliceRow[] =
    seedNamesApplied.length === 0
      ? []
      : [
          { name: 'layers', json: bracketMatchSeed.layers, updatedAt },
          { name: 'quickFirePanels', json: bracketMatchSeed.quickFirePanels, updatedAt },
          { name: 'items', json: bracketMatchSeed.items, updatedAt },
        ];
  return {
    layers: bracketMatchSeed.layers,
    quickFirePanels: bracketMatchSeed.quickFirePanels,
    items: bracketMatchSeed.items,
    rowsToWrite,
    seedNamesApplied,
  };
}
