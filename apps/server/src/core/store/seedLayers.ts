import { type Layer, programOutputId } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/** The channel logo's layer, "Logo do canal" (BAJAOVRLAY-63): the logo bug's default layer. */
export const channelLogoLayerId = 'channel-logo';

/** The match bug's layer, "Partida da chave" (BAJAOVRLAY-65): its default layer. */
export const bracketMatchLayerId = 'bracket-match';

/**
 * The plain sponsor roll's layer, "Patrocinadores (rodízio)" (BAJAOVRLAY-64): the roll's
 * default layer.
 */
export const plainSponsorRollLayerId = 'sponsor-roll-plain';

/**
 * The layers seeded on the first boot, bottom to top, all on the program output; since
 * BAJAOVRLAY-49 the operator edits them on "Saídas e camadas". The z-indexes leave gaps of
 * ten so a layer can be slotted in between later without renumbering the others; the
 * tower (BAJAOVRLAY-22) is the first to use a gap, at 35: it stacks under the clock on
 * the same right-hand column, so it sits next to the clock in the z-order, between the
 * clock and the lower third. The notice (BAJAOVRLAY-44, PR #21's layer plan) is the
 * second, at 45: the fastest lap and penalty card under the bug, above the lower third,
 * transient (each notice leaves after its rule's time). The channel logo (BAJAOVRLAY-63)
 * is the third, at 15, between the bug and the ticker, the match bug (BAJAOVRLAY-65)
 * the fourth, at 17, just above it, and the plain sponsor roll (BAJAOVRLAY-64) the fifth,
 * at 12, just above the bug; their reasons are written beside them.
 *
 * Every layer swaps graphics `out-then-in`, the safest policy: two graphics never
 * overlap on the same layer. The logo, the channel logo, the clock and the tower are
 * `persistent`, the things meant to stay on screen across rundown items (the flag has no
 * effect until M1).
 *
 * A layer added here after a database was first seeded reaches that database only if it
 * was written before outputs existed (addSeededLayersMissingFromStoredLayers, called by
 * modules/outputs at boot): from then on the layers are the operator's, and a seeded
 * layer the operator deleted must stay deleted. A layer that must reach every database
 * once needs a one-off seed recorded in `seeds_done`, as the channel logo has.
 */
export const seededLayers: Layer[] = [
  {
    id: 'bug',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.bug,
    zIndex: 10,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  // The plain sponsor roll (BAJAOVRLAY-64) at 12, the first z above the bug's, with the bug's
  // footprint (the card is the bug's width, top-left by default): a pass covers the sponsor bug
  // in its corner and, when the roll leaves, the bug is still there under it (João's ruling at
  // gate 2 of PR #59: the sponsor bug stays up all day). Not persistent: the roll leaves by
  // itself after one pass. Under the channel logo, the ticker and everything else, like the bug.
  // Added once to a database that existed before it (seedPlainSponsorRoll.ts).
  {
    id: plainSponsorRollLayerId,
    outputId: programOutputId,
    name: ptBR.seededLayerNames.plainSponsorRoll,
    zIndex: 12,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  // The channel logo (BAJAOVRLAY-63) at 15: its own layer, so it can be on air beside the
  // sponsor bug, and the first z above the bug's. Under the ticker, the clock and everything
  // else, on purpose: in a bottom corner the bars cover it while they are up, and in a top
  // corner the clock and the tower do, so live information always wins over a static logo
  // and the logo never hides a number. Persistent like the bug: it stays across items.
  // Added once to a database that existed before it (seedChannelLogo.ts).
  {
    id: channelLogoLayerId,
    outputId: programOutputId,
    name: ptBR.seededLayerNames.channelLogo,
    zIndex: 15,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  // The Super Prime's match bug (BAJAOVRLAY-65) at 17: its own layer, so "agora" can stay
  // on air beside the sponsor bug and the channel logo, just above the logo for the same
  // reason the logo sits low: the bars, the clock and the tower cover it while they are up,
  // so live race information always wins. Persistent: it stays across items. Added once to
  // a database that existed before it (seedBracketMatchGraphics.ts).
  {
    id: bracketMatchLayerId,
    outputId: programOutputId,
    name: ptBR.seededLayerNames.bracketMatch,
    zIndex: 17,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'ticker',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.ticker,
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'clock',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.clock,
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'tower',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.tower,
    zIndex: 35,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'lower-third',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.lowerThird,
    zIndex: 40,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'notice',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.notice,
    zIndex: 45,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'fullscreen',
    outputId: programOutputId,
    name: ptBR.seededLayerNames.fullscreen,
    zIndex: 50,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
];

/**
 * The stored layers of an earlier boot plus every seeded layer they lack, in z-order.
 * A database seeded before a layer existed (the tower, BAJAOVRLAY-22) must gain it at
 * boot, or no graphic could ever be placed on it there. The stored layers are kept as
 * they are, the missing ones appended, and the whole list sorted by zIndex so the new
 * layer takes its place. `addedLayerIds` tells the caller whether the layers row must
 * be written again; it is empty on a database that already has every seeded layer.
 */
export function addSeededLayersMissingFromStoredLayers(storedLayers: Layer[]): {
  layers: Layer[];
  addedLayerIds: string[];
} {
  const storedLayerIds = new Set(storedLayers.map((layer) => layer.id));
  const missingLayers = seededLayers.filter((layer) => !storedLayerIds.has(layer.id));
  if (missingLayers.length === 0) {
    return { layers: storedLayers, addedLayerIds: [] };
  }
  const layersInZOrder = [...storedLayers, ...missingLayers].sort(
    (lower, higher) => lower.zIndex - higher.zIndex,
  );
  return { layers: layersInZOrder, addedLayerIds: missingLayers.map((layer) => layer.id) };
}

/** The layers after a one-off seed of one layer, and whether the operator's layer was in the way. */
export type SeededLayerAddition = {
  layers: Layer[];
  /** Set when the layer could not be added: the operator's own layer holds its height. */
  zIndexTakenByTheOperator: number | undefined;
};

/**
 * The layers with one seeded layer added in its z-order place, for a one-off seed (the
 * channel logo's, BAJAOVRLAY-63; the plain sponsor roll's, BAJAOVRLAY-64). A layer already
 * there is kept as it is. When another layer of the same output holds the seeded height,
 * nothing is added and that height is handed back, so the seed adds nothing that would go on
 * it and warns. Throws for a layer id seededLayers does not list: a bug in the caller.
 */
export function addTheSeededLayerUnlessItsHeightIsTaken(
  layers: Layer[],
  seededLayerId: string,
): SeededLayerAddition {
  const seededLayer = seededLayers.find((layer) => layer.id === seededLayerId);
  if (seededLayer === undefined) {
    throw new Error(`the layer ${seededLayerId} is missing from seededLayers; this is a bug`);
  }
  const isLayerThere = layers.some((layer) => layer.id === seededLayerId);
  if (isLayerThere) {
    return { layers, zIndexTakenByTheOperator: undefined };
  }
  const isHeightTaken = layers.some(
    (layer) => layer.outputId === seededLayer.outputId && layer.zIndex === seededLayer.zIndex,
  );
  if (isHeightTaken) {
    return { layers, zIndexTakenByTheOperator: seededLayer.zIndex };
  }
  const layersInZOrder = [...layers, seededLayer].sort(
    (lower, higher) => lower.zIndex - higher.zIndex,
  );
  return { layers: layersInZOrder, zIndexTakenByTheOperator: undefined };
}
