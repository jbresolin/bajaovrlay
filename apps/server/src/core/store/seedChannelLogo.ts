import type { Item, Layer, QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { channelLogoLayerId, seededLayers } from './seedLayers.js';

/** The name the channel logo's seed is recorded under in `seeds_done`. */
export const channelLogoSeedName = 'channelLogo';

/** The seeded item's id, fixed and readable like the other seeded ids. */
const channelLogoItemId = 'logo-do-canal';

/**
 * The "Logo do canal" item on the logo bug and its layer, with no image chosen: the
 * operator only picks the file, and until then the form's required field refuses it. The
 * corner, height and opacity are written as the graphic's defaults (logo-bug.ograf.json)
 * so the operator sees them in the form; "neutral" since nothing about a logo is urgent.
 */
function buildChannelLogoItem(panelId: string, order: number): Item {
  return {
    id: channelLogoItemId,
    home: { kind: 'quickFire', panelId },
    order,
    graphicId: 'logo-bug',
    layerId: channelLogoLayerId,
    label: ptBR.seededChannelLogoItemLabel,
    color: 'neutral',
    notes: '',
    fields: {
      corner: { kind: 'literal', value: 'bottom-right' },
      heightPx: { kind: 'literal', value: 80 },
      opacityPercent: { kind: 'literal', value: 100 },
    },
  };
}

/** The layers and items after the channel logo's seed, and what the boot must do about it. */
export type ChannelLogoSeedOutcome = {
  layers: Layer[];
  items: Item[];
  /** False when the seed was already done here: nothing changed, nothing to write. */
  isSeedApplied: boolean;
  /** Set when the layer could not be added: the operator's own layer holds its height. */
  zIndexTakenByTheOperator: number | undefined;
};

/** The first quick-fire panel; a database always has one ("Atalhos" unless renamed). */
function findFirstQuickFirePanel(quickFirePanels: QuickFirePanel[]): QuickFirePanel | undefined {
  const panelsInOrder = [...quickFirePanels].sort((earlier, later) => earlier.order - later.order);
  return panelsInOrder[0];
}

/**
 * Adds the "Logo do canal" layer (in its z-order place on program) and item (after the
 * last item of the first quick-fire panel) once per database: nothing when `seeds_done`
 * already names the seed. Either one already there (a new database's layer comes from
 * seededLayers) is kept as it is. When the operator's own layer holds the seeded height,
 * neither is added: the item would have no layer to go on. The seed counts as applied
 * all the same, so the boot records it and never tries again.
 */
export function addChannelLogoLayerAndItemOnce(options: {
  seedNamesDone: string[];
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
}): ChannelLogoSeedOutcome {
  const unchanged = { layers: options.layers, items: options.items };
  if (options.seedNamesDone.includes(channelLogoSeedName)) {
    return { ...unchanged, isSeedApplied: false, zIndexTakenByTheOperator: undefined };
  }

  const seededLayer = seededLayers.find((layer) => layer.id === channelLogoLayerId);
  if (seededLayer === undefined) {
    throw new Error('the channel logo layer is missing from seededLayers; this is a bug');
  }
  const isLayerThere = options.layers.some((layer) => layer.id === channelLogoLayerId);
  const layerAtTheSeededHeight = options.layers.find(
    (layer) => layer.outputId === seededLayer.outputId && layer.zIndex === seededLayer.zIndex,
  );
  if (!isLayerThere && layerAtTheSeededHeight !== undefined) {
    return { ...unchanged, isSeedApplied: true, zIndexTakenByTheOperator: seededLayer.zIndex };
  }
  const layersAfter = isLayerThere
    ? options.layers
    : [...options.layers, seededLayer].sort((lower, higher) => lower.zIndex - higher.zIndex);

  const isItemThere = options.items.some((item) => item.id === channelLogoItemId);
  const panel = findFirstQuickFirePanel(options.quickFirePanels);
  if (isItemThere || panel === undefined) {
    return {
      layers: layersAfter,
      items: options.items,
      isSeedApplied: true,
      zIndexTakenByTheOperator: undefined,
    };
  }
  const itemsOfThePanel = options.items.filter(
    (item) => item.home.kind === 'quickFire' && item.home.panelId === panel.id,
  );
  const channelLogoItem = buildChannelLogoItem(panel.id, itemsOfThePanel.length);
  return {
    layers: layersAfter,
    items: [...options.items, channelLogoItem],
    isSeedApplied: true,
    zIndexTakenByTheOperator: undefined,
  };
}
