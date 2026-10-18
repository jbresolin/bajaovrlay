/**
 * What "Salvar como item" on a Camadas row opens the item editor with, for an instance
 * that has no item (put on air by hand before BAJAOVRLAY-37), and where the new item goes.
 * Pure functions.
 */
import type {
  Instance,
  ItemFields,
  ItemHome,
  QuickFirePanel,
  Rundown,
  WallClockFieldsChoice,
} from '@bajaovrlay/shared';

import type { ItemEditorPrefill } from '@/features/items/ItemEditorTargetProvider';
import { listQuickFireTabsInOrder } from '@/features/quickFire/quickFireTabs';
import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';

/**
 * Builds the editor's prefill: the instance's graphic and layer, and each field on air as
 * a typed value, except the graphic's wall-clock moments, which follow the operator's
 * choice: `keepMoment` keeps the moment on air as a typed number (every take continues
 * that very clock), `atTake` makes it the moment of each take.
 */
export function buildItemSavedFromInstanceWithoutItem(
  instance: Instance,
  wallClockFieldKeys: string[],
  wallClockFields: WallClockFieldsChoice,
): ItemEditorPrefill {
  const fields: ItemFields = {};
  for (const [fieldKey, valueOnAir] of Object.entries(instance.resolvedData)) {
    const isMomentOfEachTake =
      wallClockFieldKeys.includes(fieldKey) && wallClockFields === 'atTake';
    fields[fieldKey] = isMomentOfEachTake
      ? { kind: 'takeTime' }
      : { kind: 'literal', value: valueOnAir };
  }
  return { graphicId: instance.graphicId, layerId: instance.layerId, fields };
}

/**
 * Where an item saved from Camadas goes unless the operator changes "Onde": the rundown on
 * screen; with none, the first shortcut panel in tab order. Undefined when the server
 * listed neither (it seeds both, so never in practice), and then "Salvar como item" is
 * not offered: the page names no home the server does not know.
 */
export function chooseHomeOfItemSavedFromCamadas(
  rundowns: Rundown[],
  panels: QuickFirePanel[],
): ItemHome | undefined {
  const rundownShown = findRundownShownOnPage(rundowns);
  if (rundownShown !== undefined) {
    return { kind: 'rundown', rundownId: rundownShown.id };
  }
  const firstPanelTab = listQuickFireTabsInOrder(panels).find((tab) => tab.kind === 'panel');
  if (firstPanelTab?.kind === 'panel') {
    return { kind: 'quickFire', panelId: firstPanelTab.panelId };
  }
  return undefined;
}
