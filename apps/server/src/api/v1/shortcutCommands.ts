// The commands four button shortcuts of the command API build from the state (BAJAOVRLAY-28).
// The other six shortcuts carry everything their command needs in their address. These
// only read the slices to fill in what a fixed URL cannot know; whether the command is
// allowed and what it does is left to the store's one path, as for any command.
import type { Command, CommandError, Slices } from '@bajaovrlay/shared';

import { findQuickFireButtonAtItsPlace } from './quickFireButtonByPlace.js';

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
 * note of 2026-10-11): takeItem of the panel's n-th button, found as
 * quickFireButtonByPlace.ts counts. It is the very command a click on the button sends, so
 * it never moves the cursor, and an item filled by an event is refused by the store as
 * for a click. A panel or a number that does not exist is refused here, as no command can
 * name it.
 */
export function buildTakeItemCommandOfQuickFireButton(
  slices: Slices,
  panelId: string,
  buttonNumberAsSent: string,
): QuickFireButtonCommand {
  const button = findQuickFireButtonAtItsPlace(slices, panelId, buttonNumberAsSent);
  if (!button.isFound) {
    return { isFound: false, refusal: button.refusal };
  }
  return { isFound: true, command: { type: 'takeItem', itemId: button.item.id } };
}
