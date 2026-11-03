// A quick-fire button found by its place, as a pad maps its keys (João's note of
// 2026-10-11): the n-th button of a panel, counted from 1 in the panel's order, as the
// digit keys count them but with no cap at nine. fire-shortcut (BAJAOVRLAY-28) presses
// it and state/shortcut (BAJAOVRLAY-56) reads it; both find it here, so a D200 button
// always lights for the very item it fires.
import {
  type CommandError,
  type Item,
  listItemsOfQuickFirePanelInOrder,
  type Slices,
} from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { refuseUnknownQuickFirePanel } from '../../core/store/quickFireAndMacroRefusals.js';

/** The item at a panel's place, or why there is none (no such panel, no such button). */
export type QuickFireButtonAtItsPlace =
  { isFound: true; item: Item } | { isFound: false; refusal: CommandError };

/**
 * Finds the item at button `buttonNumberAsSent` of a panel. The number is the URL's text:
 * only digits count, so "2.5", "-1", " 2", "dois" and "0" name no button.
 * What could go wrong: the n-th button is whatever sits there now, so a button moved on
 * the page is found at its new place, as a digit key finds it.
 */
export function findQuickFireButtonAtItsPlace(
  slices: Slices,
  panelId: string,
  buttonNumberAsSent: string,
): QuickFireButtonAtItsPlace {
  const panel = slices.quickFirePanels.find((candidate) => candidate.id === panelId);
  if (panel === undefined) {
    return { isFound: false, refusal: refuseUnknownQuickFirePanel(panelId) };
  }
  const buttonsInOrder = listItemsOfQuickFirePanelInOrder(slices.items, panelId);
  const isWrittenAsDigits = /^[0-9]+$/.test(buttonNumberAsSent);
  const buttonNumber = isWrittenAsDigits ? Number(buttonNumberAsSent) : 0;
  const item = buttonNumber >= 1 ? buttonsInOrder[buttonNumber - 1] : undefined;
  if (item === undefined) {
    const refusal: CommandError = {
      code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
      message: ptBR.quickFirePanelErrors.buttonNotFound(
        panel.name,
        buttonNumberAsSent,
        buttonsInOrder.length,
      ),
    };
    return { isFound: false, refusal };
  }
  return { isFound: true, item };
}
