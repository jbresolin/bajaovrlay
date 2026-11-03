// What a D200 button shows, read from the slices (BAJAOVRLAY-56): one layer, one
// quick-fire button or one macro, each as a flat object, because the D200's HTTP plugin
// reads one value by a one-word JSON path. Pure functions over the slices in memory: no
// database, no command, no event-log row, so a button may poll every second.
import type { CommandError, Instance, Slices } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../../core/store/commandRefusals.js';
import { refuseUnknownMacro } from '../../core/store/quickFireAndMacroRefusals.js';
import { findInstanceOnLayer, readItemLabelOfInstance } from './instancesOnLayers.js';
import { findQuickFireButtonAtItsPlace } from './quickFireButtonByPlace.js';

/** One layer, as a button reads it. */
export type LayerButtonState = {
  isOnAir: boolean;
  isInPreview: boolean;
  /** Marked "vai limpar" in Prévia: the next take of the layer clears it. */
  isMarkedToClear: boolean;
  /** The label of the item on program; "" with nothing there or when its item was deleted. */
  itemName: string;
};

/** One quick-fire button, as a button reads it. */
export type ShortcutButtonState = { isOnAir: boolean; isInPreview: boolean };

/** One macro, as a button reads it. */
export type MacroButtonState = { isRunning: boolean };

/** A state that was found, or the refusal naming what does not exist. */
export type ButtonStateLookup<State> =
  { isFound: true; state: State } | { isFound: false; refusal: CommandError };

/**
 * The state of one layer. On air and in preview count any instance on the layer (loading,
 * on air, stopping or failed), as /layers/status counts them.
 * Deliberate: `itemName` is "" rather than null with nothing on air, so the plugin always
 * finds a text at its path.
 */
export function readStateOfLayerForAButton(
  slices: Slices,
  layerId: string,
): ButtonStateLookup<LayerButtonState> {
  const layerExists = slices.layers.some((layer) => layer.id === layerId);
  if (!layerExists) {
    return { isFound: false, refusal: refuseUnknownLayer(layerId) };
  }
  const instanceOnAir = findInstanceOnLayer(slices.instances, layerId, 'program');
  const instanceInPreview = findInstanceOnLayer(slices.instances, layerId, 'preview');
  const state: LayerButtonState = {
    isOnAir: instanceOnAir !== undefined,
    isInPreview: instanceInPreview !== undefined,
    isMarkedToClear: slices.previewClearedLayerIds.includes(layerId),
    itemName: readItemNameForAButton(slices, instanceOnAir),
  };
  return { isFound: true, state };
}

/**
 * The state of the n-th button of a quick-fire panel, counted as fire-shortcut counts
 * (quickFireButtonByPlace.ts): on air while an instance of that button's item is on
 * program, in preview while one is in Prévia.
 * Deliberate: it follows the item, not the layer, so the button stays dark while another
 * item of the panel is on air on the same layer.
 */
export function readStateOfQuickFireButtonForAButton(
  slices: Slices,
  panelId: string,
  buttonNumberAsSent: string,
): ButtonStateLookup<ShortcutButtonState> {
  const button = findQuickFireButtonAtItsPlace(slices, panelId, buttonNumberAsSent);
  if (!button.isFound) {
    return { isFound: false, refusal: button.refusal };
  }
  const itemId = button.item.id;
  const isOnAir = slices.instances.some(
    (instance) => instance.itemId === itemId && instance.target === 'program',
  );
  const isInPreview = slices.instances.some(
    (instance) => instance.itemId === itemId && instance.target === 'preview',
  );
  return { isFound: true, state: { isOnAir, isInPreview } };
}

/**
 * The state of one macro: running from its press until its run ends.
 * Deliberate: a macro asked to stop ("Parar") still counts as running until the step in
 * progress ends and its run is gone, because until then it may still change the screen.
 */
export function readStateOfMacroForAButton(
  slices: Slices,
  macroId: string,
): ButtonStateLookup<MacroButtonState> {
  const macroExists = slices.macros.some((macro) => macro.id === macroId);
  if (!macroExists) {
    return { isFound: false, refusal: refuseUnknownMacro(macroId) };
  }
  const isRunning = slices.macroRuns.some((run) => run.macroId === macroId);
  return { isFound: true, state: { isRunning } };
}

/** The label of the item on program, or "" when there is none, so the plugin always finds a text. */
function readItemNameForAButton(slices: Slices, instance: Instance | undefined): string {
  return readItemLabelOfInstance(slices, instance) ?? '';
}
