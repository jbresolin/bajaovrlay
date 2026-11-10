// What is on a layer and what names it: the two things that stop a layer from being
// deleted (or, for the first, moved to another output). Pure; reads only the slices.
import type { Layer } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';

/**
 * The sentences of what is on the layer now: a graphic on air, one in preview, a "vai
 * limpar" mark; empty when the layer is clear. A layer with something on it cannot be
 * deleted (a graphic would lose its container mid-show) or moved (it would jump from one
 * OBS source to another).
 */
export function describeWhatIsOnTheLayer(
  slices: SlicesChangedByCommands,
  layerId: string,
): string[] {
  const instancesOnTheLayer = slices.instances.filter((instance) => instance.layerId === layerId);
  const isOnAir = instancesOnTheLayer.some((instance) => instance.target === 'program');
  const isInPreview = instancesOnTheLayer.some((instance) => instance.target === 'preview');
  const isMarkedToClear = slices.previewClearedLayerIds.includes(layerId);

  const whatIsOnIt: string[] = [];
  if (isOnAir) {
    whatIsOnIt.push(ptBR.outputs.thingsOnALayer.onAir);
  }
  if (isInPreview) {
    whatIsOnIt.push(ptBR.outputs.thingsOnALayer.inPreview);
  }
  if (isMarkedToClear) {
    whatIsOnIt.push(ptBR.outputs.thingsOnALayer.markedToClear);
  }
  return whatIsOnIt;
}

/**
 * The uses of the layer, one entry per kind that has any, in this order: items of a
 * rundown, quick-fire buttons, event templates (BAJAOVRLAY-67), macros with a step that clears it, and event rules whose
 * item is on it (a rule names an item, not a layer, so its notice lands where the item
 * does). Each entry is counted and names its uses: `2 itens: "A", "B"`. Empty when
 * nothing names the layer. A graphic's default layer is not a use: it is only the
 * editor's first choice, and deleteLayer moves it to the fallback layer.
 */
export function describeUsesOfTheLayer(slices: SlicesChangedByCommands, layer: Layer): string[] {
  const itemsOnTheLayer = slices.items.filter((item) => item.layerId === layer.id);
  const rundownItemLabels = itemsOnTheLayer
    .filter((item) => item.home.kind === 'rundown')
    .map((item) => item.label);
  const shortcutLabels = itemsOnTheLayer
    .filter((item) => item.home.kind === 'quickFire')
    .map((item) => item.label);
  const eventTemplateLabels = itemsOnTheLayer
    .filter((item) => item.home.kind === 'eventTemplates')
    .map((item) => item.label);
  const macroLabels = slices.macros
    .filter((macro) =>
      macro.steps.some((step) => step.kind === 'clearLayer' && step.layerId === layer.id),
    )
    .map((macro) => macro.label);
  const itemIdsOnTheLayer = new Set(itemsOnTheLayer.map((item) => item.id));
  const eventRuleNames = slices.eventRules
    .filter((rule) => rule.itemId !== null && itemIdsOnTheLayer.has(rule.itemId))
    .map((rule) => ptBR.eventErrors.kindNames[rule.kind]);

  const usesOfEachKind: string[] = [];
  if (rundownItemLabels.length > 0) {
    usesOfEachKind.push(ptBR.outputs.usesOfAKind.items(rundownItemLabels));
  }
  if (shortcutLabels.length > 0) {
    usesOfEachKind.push(ptBR.outputs.usesOfAKind.shortcuts(shortcutLabels));
  }
  if (eventTemplateLabels.length > 0) {
    usesOfEachKind.push(ptBR.outputs.usesOfAKind.eventTemplates(eventTemplateLabels));
  }
  if (macroLabels.length > 0) {
    usesOfEachKind.push(ptBR.outputs.usesOfAKind.macros(macroLabels));
  }
  if (eventRuleNames.length > 0) {
    usesOfEachKind.push(ptBR.outputs.usesOfAKind.eventRules(eventRuleNames));
  }
  return usesOfEachKind;
}
