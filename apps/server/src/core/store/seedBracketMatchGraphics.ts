import type { Item, ItemFields, Layer, QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { bracketMatchLayerId, seededLayers } from './seedLayers.js';

/** The name the match graphics' seed is recorded under in `seeds_done`. */
export const bracketMatchGraphicsSeedName = 'bracketMatchGraphics';

/** The seeded panel's id, fixed and readable like "atalhos". */
const bracketMatchPanelId = 'chave';

/** The seeded items' ids, fixed and readable like the other seeded ids. */
const matchNowItemId = 'partida-agora';
const matchUpNextItemId = 'partida-a-seguir';

/**
 * The source the seeded items read: the seeded simulator, whose Super Prime is there for
 * rehearsal (BAJAOVRLAY-25). On the day the operator points them at the real tournament.
 */
const seededSimulatorSourceId = 'simulador-enduro';

/** A live binding to a path of the seeded simulator's brackets. */
function bindToSimulatorBrackets(path: string): ItemFields[string] {
  return {
    kind: 'binding',
    sourceId: seededSimulatorSourceId,
    shapeKey: 'brackets',
    path,
    isLive: true,
  };
}

/**
 * The match bug's fields, each bound to the match "agora" (`matchNow.`), and its corner:
 * top-left, beside the sponsor bug, as the graphic's default.
 */
function buildMatchBugFields(): ItemFields {
  return {
    roundName: bindToSimulatorBrackets('matchNow.roundName'),
    bestOf: bindToSimulatorBrackets('matchNow.bestOf'),
    carANumber: bindToSimulatorBrackets('matchNow.carA.carNumber'),
    carAShortName: bindToSimulatorBrackets('matchNow.carA.shortName'),
    carAWins: bindToSimulatorBrackets('matchNow.carA.wins'),
    carATimeMs: bindToSimulatorBrackets('matchNow.carA.timeMs'),
    carBNumber: bindToSimulatorBrackets('matchNow.carB.carNumber'),
    carBShortName: bindToSimulatorBrackets('matchNow.carB.shortName'),
    carBWins: bindToSimulatorBrackets('matchNow.carB.wins'),
    carBTimeMs: bindToSimulatorBrackets('matchNow.carB.timeMs'),
    winnerCarNumber: bindToSimulatorBrackets('matchNow.winnerCarNumber'),
    corner: { kind: 'literal', value: 'top-left' },
  };
}

/** The "a seguir" card's fields of one car, bound to that car of the match "a seguir". */
function buildCardFieldsOfOneCar(side: 'carA' | 'carB'): ItemFields {
  const prefix = `matchUpNext.${side}`;
  return {
    [`${side}Number`]: bindToSimulatorBrackets(`${prefix}.carNumber`),
    [`${side}TeamName`]: bindToSimulatorBrackets(`${prefix}.teamName`),
    [`${side}SchoolName`]: bindToSimulatorBrackets(`${prefix}.schoolName`),
    [`${side}City`]: bindToSimulatorBrackets(`${prefix}.city`),
    [`${side}State`]: bindToSimulatorBrackets(`${prefix}.state`),
    [`${side}LogoUrl`]: bindToSimulatorBrackets(`${prefix}.logoUrl`),
    [`${side}LogoOnLightPlate`]: bindToSimulatorBrackets(`${prefix}.logoOnLightPlate`),
    [`${side}Wins`]: bindToSimulatorBrackets(`${prefix}.wins`),
    [`${side}TimeMs`]: bindToSimulatorBrackets(`${prefix}.timeMs`),
  };
}

/** The "a seguir" card's fields, every one bound to the match "a seguir" (`matchUpNext.`). */
function buildMatchCardFields(): ItemFields {
  return {
    roundName: bindToSimulatorBrackets('matchUpNext.roundName'),
    bestOf: bindToSimulatorBrackets('matchUpNext.bestOf'),
    ...buildCardFieldsOfOneCar('carA'),
    ...buildCardFieldsOfOneCar('carB'),
  };
}

/** The two items of the "Chave" panel, the bug first, at the panel's first two buttons. */
function buildMatchItems(): Item[] {
  const home = { kind: 'quickFire' as const, panelId: bracketMatchPanelId };
  const labels = ptBR.seededBracketMatchItemLabels;
  return [
    {
      id: matchNowItemId,
      home,
      order: 0,
      graphicId: 'bracket-match-bug',
      layerId: bracketMatchLayerId,
      label: labels.now,
      color: 'neutral',
      notes: '',
      fields: buildMatchBugFields(),
    },
    {
      id: matchUpNextItemId,
      home,
      order: 1,
      graphicId: 'bracket-match-card',
      layerId: 'lower-third',
      label: labels.upNext,
      color: 'neutral',
      notes: '',
      fields: buildMatchCardFields(),
    },
  ];
}

/** The layers, panels and items after the match graphics' seed, and what the boot must do. */
export type BracketMatchGraphicsSeedOutcome = {
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  /** False when the seed was already done here: nothing changed, nothing to write. */
  isSeedApplied: boolean;
  /** Set when the layer could not be added: the operator's own layer holds its height. */
  zIndexTakenByTheOperator: number | undefined;
};

/** The panels with the "Chave" panel after the last one, unless it is there already. */
function addBracketMatchPanelAfterTheLast(quickFirePanels: QuickFirePanel[]): QuickFirePanel[] {
  const isPanelThere = quickFirePanels.some((panel) => panel.id === bracketMatchPanelId);
  if (isPanelThere) {
    return quickFirePanels;
  }
  const lastOrder = Math.max(-1, ...quickFirePanels.map((panel) => panel.order));
  const bracketMatchPanel: QuickFirePanel = {
    id: bracketMatchPanelId,
    name: ptBR.seededBracketMatchPanelName,
    order: lastOrder + 1,
  };
  return [...quickFirePanels, bracketMatchPanel];
}

/**
 * Adds the "Partida da chave" layer (in its z-order place on program), a "Chave"
 * quick-fire panel after the last one, and its two items ("Partida agora", "Partida a
 * seguir"), once per database: nothing when `seeds_done` already names the seed. The
 * channel logo's seed is the model (seedChannelLogo.ts): anything already there is kept;
 * when the operator's own layer holds the seeded height none is added, the items with it
 * (the bug would have no layer to go on), and the seed counts as applied all the same, so
 * the boot records it and never tries again. Deliberate: a panel of its own, as the logo
 * has, so neither item takes a button of "Atalhos" from the operator's own.
 */
export function addBracketMatchLayerAndItemsOnce(options: {
  seedNamesDone: string[];
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
}): BracketMatchGraphicsSeedOutcome {
  const unchanged = {
    layers: options.layers,
    quickFirePanels: options.quickFirePanels,
    items: options.items,
  };
  if (options.seedNamesDone.includes(bracketMatchGraphicsSeedName)) {
    return { ...unchanged, isSeedApplied: false, zIndexTakenByTheOperator: undefined };
  }

  const seededLayer = seededLayers.find((layer) => layer.id === bracketMatchLayerId);
  if (seededLayer === undefined) {
    throw new Error('the match bug layer is missing from seededLayers; this is a bug');
  }
  const isLayerThere = options.layers.some((layer) => layer.id === bracketMatchLayerId);
  const layerAtTheSeededHeight = options.layers.find(
    (layer) => layer.outputId === seededLayer.outputId && layer.zIndex === seededLayer.zIndex,
  );
  if (!isLayerThere && layerAtTheSeededHeight !== undefined) {
    return { ...unchanged, isSeedApplied: true, zIndexTakenByTheOperator: seededLayer.zIndex };
  }
  const layersAfter = isLayerThere
    ? options.layers
    : [...options.layers, seededLayer].sort((lower, higher) => lower.zIndex - higher.zIndex);

  const itemIdsThere = new Set(options.items.map((item) => item.id));
  const itemsToAdd = buildMatchItems().filter((item) => !itemIdsThere.has(item.id));
  return {
    layers: layersAfter,
    quickFirePanels: addBracketMatchPanelAfterTheLast(options.quickFirePanels),
    items: [...options.items, ...itemsToAdd],
    isSeedApplied: true,
    zIndexTakenByTheOperator: undefined,
  };
}
