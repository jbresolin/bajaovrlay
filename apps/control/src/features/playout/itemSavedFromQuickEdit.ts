/**
 * What "Salvar como item" of "Edição rápida" opens the item editor with. A pure function.
 */
import type { ItemHome, QuickFirePanel, Rundown } from '@bajaovrlay/shared';

import type { ItemEditorPrefill } from '@/features/items/ItemEditorTargetProvider';
import { listQuickFireTabsInOrder } from '@/features/quickFire/quickFireTabs';
import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';
import {
  buildItemFieldsFromSchemaForm,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';

/** What "Edição rápida" holds at the press. */
export type QuickEditContents = {
  description: SchemaFormDescription;
  graphicId: string;
  /** The loaded instance's layer, or the layer chosen for a new entry. */
  layerId: string;
  /** The form after it passed its rules. */
  formValues: SchemaFormValues;
};

/** Where the new item goes unless the operator changes "Onde", and what it is prefilled with. */
export type ItemSavedFromQuickEdit = {
  home: ItemHome;
  prefill: ItemEditorPrefill;
};

/**
 * Builds the editor's opening for "Salvar como item": the graphic, the layer and every
 * field of the form, each in the kind the form shows it in (a typed value is stored as a
 * literal, "Momento da entrada no ar" as takeTime, a blank optional field is left out),
 * exactly as the item editor stores a new item (buildItemFieldsFromSchemaForm). The home
 * is the rundown on screen, or the first shortcut panel in tab order when there is none.
 * What could go wrong: the time field of a loaded clock SHOWS the time on screen but
 * HOLDS the reading on air, so the item stores that reading with its moment as a typed
 * number; the operator switches the moment to "Momento da entrada no ar" in the editor
 * to have the item start a fresh clock at each take.
 */
export function buildItemSavedFromQuickEdit(
  contents: QuickEditContents,
  rundowns: Rundown[],
  panels: QuickFirePanel[],
): ItemSavedFromQuickEdit {
  const prefill: ItemEditorPrefill = {
    graphicId: contents.graphicId,
    layerId: contents.layerId,
    fields: buildItemFieldsFromSchemaForm(contents.description, contents.formValues),
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
