/**
 * What "Salvar como item" on a Camadas row opens the item editor with, for an instance
 * that has no item (put on air by hand before BAJAOVRLAY-37). A pure function.
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

/** Where the new item goes unless the operator changes "Onde", and what it is prefilled with. */
export type ItemSavedFromInstance = {
  home: ItemHome;
  prefill: ItemEditorPrefill;
};

/**
 * Builds the editor's opening: the instance's graphic and layer, and each field on air as
 * a typed value, except the graphic's wall-clock moments, which follow the operator's
 * choice: `keepMoment` keeps the moment on air as a typed number (every take continues
 * that very clock), `atTake` makes it the moment of each take. The home is the rundown on
 * screen, or the first shortcut panel in tab order when there is none.
 */
export function buildItemSavedFromInstanceWithoutItem(
  instance: Instance,
  wallClockFieldKeys: string[],
  wallClockFields: WallClockFieldsChoice,
  rundowns: Rundown[],
  panels: QuickFirePanel[],
): ItemSavedFromInstance {
  const fields: ItemFields = {};
  for (const [fieldKey, valueOnAir] of Object.entries(instance.resolvedData)) {
    const isMomentOfEachTake =
      wallClockFieldKeys.includes(fieldKey) && wallClockFields === 'atTake';
    fields[fieldKey] = isMomentOfEachTake
      ? { kind: 'takeTime' }
      : { kind: 'literal', value: valueOnAir };
  }
  const prefill: ItemEditorPrefill = {
    graphicId: instance.graphicId,
    layerId: instance.layerId,
    fields,
  };
  return { home: chooseHomeOfTheNewItem(rundowns, panels), prefill };
}

/**
 * The rundown on screen; with none, the first shortcut panel in tab order. With neither
 * (a server that sent no rundown and no panel, which it never does: both are seeded) the
 * seeded panel's id is named, and the server refuses it with its own message.
 */
function chooseHomeOfTheNewItem(rundowns: Rundown[], panels: QuickFirePanel[]): ItemHome {
  const rundownShown = findRundownShownOnPage(rundowns);
  if (rundownShown !== undefined) {
    return { kind: 'rundown', rundownId: rundownShown.id };
  }
  const firstPanelTab = listQuickFireTabsInOrder(panels).find((tab) => tab.kind === 'panel');
  const panelId = firstPanelTab?.kind === 'panel' ? firstPanelTab.panelId : 'atalhos';
  return { kind: 'quickFire', panelId };
}
