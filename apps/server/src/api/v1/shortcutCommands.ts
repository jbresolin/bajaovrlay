// The commands four button shortcuts of the command API build from the state (BAJAOVRLAY-28).
// The other six shortcuts carry everything their command needs in their address. These
// only read the slices to fill in what a fixed URL cannot know; whether the command is
// allowed and what it does is left to the store's one path, as for any command.
import {
  type Command,
  type CommandError,
  listItemsOfQuickFirePanelInOrder,
  type Slices,
} from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { refuseUnknownQuickFirePanel } from '../../core/store/quickFireAndMacroRefusals.js';

/**
 * "Tomar" (POST /take-next): takeNext on the first rundown the server lists, the one
 * the control page shows (apps/control's rundownShownOnPage.ts). Undefined when there is
 * no rundown at all, which only a damaged database could leave: the server seeds one.
 * Deliberate: unlike the page's Space key, it never sends takePreview for a cursor item
 * already in Prévia. A fixed button does one thing; "Tomar tudo" is its own shortcut.
 */
export function buildTakeNextCommandOfTheShownRundown(slices: Slices): Command | undefined {
  const shownRundown = slices.rundowns[0];
  if (shownRundown === undefined) {
    return undefined;
  }
  return { type: 'takeNext', rundownId: shownRundown.id };
}

/**
 * "Próximo" on a layer (POST /next-on-layer/:layerId): nextOnLayer from the step the
 * graphic on the layer's program output is on now. With nothing on air the step is 0 and
 * the store refuses it as it would any "Próximo" on an empty layer.
 * What could go wrong: the page names the step the operator saw, so a double press is
 * refused (STEP_ALREADY_MOVED); a button cannot see, so two presses move two steps.
 */
export function buildNextOnLayerCommandFromTheStepOnAir(slices: Slices, layerId: string): Command {
  const instanceOnAir = slices.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  const stepOnAirNow = instanceOnAir?.currentStep ?? 0;
  return { type: 'nextOnLayer', layerId, fromStep: stepOnAirNow };
}

/**
 * "Parar" (POST /stop-macro): stopMacro of the macro running now. Undefined with no
 * macro running; the route then answers ok, as stopMacro of a macro that is not running
 * does. Only one macro runs at a time (runMacro is refused while any runs).
 */
export function buildStopMacroCommandOfTheRunningMacro(slices: Slices): Command | undefined {
  const runningMacro = slices.macroRuns[0];
  if (runningMacro === undefined) {
    return undefined;
  }
  return { type: 'stopMacro', macroId: runningMacro.macroId };
}

/** What fire-shortcut builds: the take of the button's item, or why there is no button. */
export type QuickFireButtonCommand =
  { isFound: true; command: Command } | { isFound: false; refusal: CommandError };

/**
 * A pad's button mapped to a place (POST /fire-shortcut/:panelId/:buttonNumber, João's
 * note of 2026-10-11): takeItem of the panel's n-th button, counted from 1 in the panel's
 * order, as the digit keys count them (apps/control's chooseCommandForDigitKey) but with
 * no cap at nine. It is the very command a click on the button sends, so it never moves
 * the cursor, and an item filled by an event is refused by the store as for a click. A
 * panel or a number that does not exist is refused here, as no command can name it.
 * What could go wrong: the n-th button is whatever sits there now, so a button moved on
 * the page fires from its new place, as a digit key does.
 */
export function buildTakeItemCommandOfQuickFireButton(
  slices: Slices,
  panelId: string,
  buttonNumberAsSent: string,
): QuickFireButtonCommand {
  const panel = slices.quickFirePanels.find((candidate) => candidate.id === panelId);
  if (panel === undefined) {
    return { isFound: false, refusal: refuseUnknownQuickFirePanel(panelId) };
  }
  const buttonsInOrder = listItemsOfQuickFirePanelInOrder(slices.items, panelId);
  // Only digits count: "2" is button 2, while "2.5", "-1", " 2" or "dois" name no button.
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
  return { isFound: true, command: { type: 'takeItem', itemId: item.id } };
}
