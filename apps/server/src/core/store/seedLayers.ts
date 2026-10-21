import type { Layer } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * The fixed layers seeded on the first boot, bottom to top. The z-indexes leave gaps of
 * ten so a layer can be slotted in between later without renumbering the others; the
 * tower (BAJAOVRLAY-22) is the first to use a gap, at 35: it stacks under the clock on
 * the same right-hand column, so it sits next to the clock in the z-order, between the
 * clock and the lower third.
 *
 * Every layer swaps graphics `out-then-in`, the safest policy: two graphics never
 * overlap on the same layer. The logo, the clock and the tower are `persistent`, the
 * things meant to stay on screen across rundown items (the flag has no effect until M1).
 *
 * A layer added here after a database was first seeded is added to that database on
 * its next boot (addSeededLayersMissingFromStoredLayers, called by loadInitialSlices).
 */
export const seededLayers: Layer[] = [
  {
    id: 'bug',
    name: ptBR.seededLayerNames.bug,
    zIndex: 10,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'ticker',
    name: ptBR.seededLayerNames.ticker,
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'clock',
    name: ptBR.seededLayerNames.clock,
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'tower',
    name: ptBR.seededLayerNames.tower,
    zIndex: 35,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'lower-third',
    name: ptBR.seededLayerNames.lowerThird,
    zIndex: 40,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
  {
    id: 'fullscreen',
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
