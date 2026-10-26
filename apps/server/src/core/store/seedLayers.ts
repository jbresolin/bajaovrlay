import { type Layer, programOutputId } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The layers seeded on the first boot, bottom to top, all on the program output; since
 * BAJAOVRLAY-49 the operator edits them on "Saídas e camadas". The z-indexes leave gaps of
 * ten so a layer can be slotted in between later without renumbering the others; the
 * tower (BAJAOVRLAY-22) is the first to use a gap, at 35: it stacks under the clock on
 * the same right-hand column, so it sits next to the clock in the z-order, between the
 * clock and the lower third. The notice (BAJAOVRLAY-44, PR #21's layer plan) is the
 * second, at 45: the fastest lap and penalty card under the bug, above the lower third,
 * transient (each notice leaves after its rule's time).
 *
 * Every layer swaps graphics `out-then-in`, the safest policy: two graphics never
 * overlap on the same layer. The logo, the clock and the tower are `persistent`, the
 * things meant to stay on screen across rundown items (the flag has no effect until M1).
 *
 * A layer added here after a database was first seeded reaches that database only if it
 * was written before outputs existed (addSeededLayersMissingFromStoredLayers, called by
 * modules/outputs at boot): from then on the layers are the operator's, and a seeded
 * layer the operator deleted must stay deleted.
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
