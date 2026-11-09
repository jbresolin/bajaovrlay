import type { Item, Layer, QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { channelLogoLayerId, seededLayers } from './seedLayers.js';

/** The name the channel logo's seed is recorded under in `seeds_done`. */
export const channelLogoSeedName = 'channelLogo';

/** The seeded item's id, fixed and readable like the other seeded ids. */
const channelLogoItemId = 'logo-do-canal';

/** The seeded panel's id, fixed and readable like "atalhos". */
const channelLogoPanelId = 'logo';

/**
 * The "Logo do canal" item on the logo bug and its layer, with no image chosen: the
 * operator only picks the file; until then the form's required field refuses a save and
 * the server's manifest check refuses a take. The corner, height and opacity are written
 * as the graphic's defaults (logo-bug.ograf.json) so the operator sees them in the form;
 * "neutral" since nothing about a logo is urgent.
 */
function buildChannelLogoItem(order: number): Item {
  return {
    id: channelLogoItemId,
    home: { kind: 'quickFire', panelId: channelLogoPanelId },
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

/** The layers, panels and items after the channel logo's seed, and what the boot must do. */
export type ChannelLogoSeedOutcome = {
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
  /** False when the seed was already done here: nothing changed, nothing to write. */
  isSeedApplied: boolean;
  /** Set when the layer could not be added: the operator's own layer holds its height. */
  zIndexTakenByTheOperator: number | undefined;
};

/** The panels with the "Logo" panel after the last one, unless it is there already. */
function addChannelLogoPanelAfterTheLast(quickFirePanels: QuickFirePanel[]): QuickFirePanel[] {
  const isPanelThere = quickFirePanels.some((panel) => panel.id === channelLogoPanelId);
  if (isPanelThere) {
    return quickFirePanels;
  }
  const lastOrder = Math.max(-1, ...quickFirePanels.map((panel) => panel.order));
  const channelLogoPanel: QuickFirePanel = {
    id: channelLogoPanelId,
    name: ptBR.seededChannelLogoPanelName,
    order: lastOrder + 1,
  };
  return [...quickFirePanels, channelLogoPanel];
}

/**
 * Adds the "Logo do canal" layer (in its z-order place on program), a "Logo" quick-fire
 * panel after the last one, and the item as that panel's only button, once per database:
 * nothing when `seeds_done` already names the seed. Any of them already there (a new
 * database's layer comes from seededLayers) is kept as it is. When the operator's own
 * layer holds the seeded height, none is added: the item would have no layer to go on.
 * The seed counts as applied all the same, so the boot records it and never tries again.
 */
export function addChannelLogoLayerAndItemOnce(options: {
  seedNamesDone: string[];
  layers: Layer[];
  quickFirePanels: QuickFirePanel[];
  items: Item[];
}): ChannelLogoSeedOutcome {
  const unchanged = {
    layers: options.layers,
    quickFirePanels: options.quickFirePanels,
    items: options.items,
  };
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
  if (isItemThere) {
    return {
      layers: layersAfter,
      quickFirePanels: options.quickFirePanels,
      items: options.items,
      isSeedApplied: true,
      zIndexTakenByTheOperator: undefined,
    };
  }
  // Deliberate (João's ruling at gate 2 of PR #56): a panel of its own, so the logo never
  // takes a button of "Atalhos" (fire-shortcut/atalhos/1, the D200's state routes) from
  // the operator's own. The rundown was ruled out: a new database's rundown would no
  // longer be empty, so the operator's first item would not get the cursor.
  const panelsAfter = addChannelLogoPanelAfterTheLast(options.quickFirePanels);
  const itemsOfThePanel = options.items.filter(
    (item) => item.home.kind === 'quickFire' && item.home.panelId === channelLogoPanelId,
  );
  return {
    layers: layersAfter,
    quickFirePanels: panelsAfter,
    items: [...options.items, buildChannelLogoItem(itemsOfThePanel.length)],
    isSeedApplied: true,
    zIndexTakenByTheOperator: undefined,
  };
}
