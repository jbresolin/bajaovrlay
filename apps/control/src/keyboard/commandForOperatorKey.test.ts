/**
 * What Space, Shift+Space and Backspace send (apps/control)
 *
 * What this module is for:
 *   Three keys of the operator depend on what is being previewed. Space puts the next
 *   item on air: when that item is the one showing on the preview output, the preview
 *   itself is sent to air (`takePreview`), so what goes on air is exactly what was seen;
 *   otherwise the item at the cursor is taken as before (`takeNext`). Shift+Space shows
 *   the item at the cursor on the preview output (`previewItem`). Backspace throws a
 *   preview away (`stopPreview`) when there is one, and only otherwise clears the clock
 *   layer on air, as it always did. `chooseCommandForOperatorKey` is the one place that
 *   decides this: it is handed the key, the rundown and the instances, and answers with
 *   the command to send, or null for "send nothing".
 *
 * What these tests prove:
 *   - Space: `takePreview` on the previewed layer when the preview on screen was made
 *     from the cursor item; `takeNext` when nothing is previewed, when the preview is of
 *     another item, when it was made by hand in "Edição rápida", when the cursor item is
 *     only on the program output, and when the cursor is on nothing; nothing at all
 *     while the server has sent no rundown.
 *   - Shift+Space: `previewItem` for the cursor item, also when it is previewed already;
 *     nothing when the cursor is on nothing or there is no rundown.
 *   - Backspace: `stopPreview` for the layer of the preview made most recently (the later
 *     one in the list when two were made at the same moment), whatever the rundown says;
 *     `clearLayer` for the clock layer when nothing is previewed, as before previews
 *     existed, and an instance on the program output never counts as a preview.
 *
 * What these tests deliberately do not cover:
 *   - Where the keys are ignored (typing in a field, a dropdown, a switch, a held key,
 *     Ctrl/Alt/Meta, no connection, a drag): that is useKeyboardShortcut.ts, proven by
 *     RundownPanelKeyboard.test.tsx, RundownPanelPreviewKeys.test.tsx and App.test.tsx.
 *   - What the server does with each command; apps/server's reducer tests do.
 *   - The arrows and Esc, which do not depend on previews.
 */
import type { CommandInput, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildLowerThirdPreviewMadeByHand,
  buildRaceClockPreviewOfItem,
} from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildMainRundown,
  enduranceStartItemId,
  yellowFlagItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { chooseCommandForOperatorKey, type OperatorKey } from './commandForOperatorKey';

// Saturday of the endurance race: the start is previewed at 9:58, two minutes before it
// goes on air, and the interview band a minute after that.
const momentTheStartWasPreviewed = '2026-10-10T12:58:00.000Z';
const oneMinuteLater = '2026-10-10T12:59:00.000Z';

const takeNextOfTheMainRundown: CommandInput = { type: 'takeNext', rundownId: 'sessao-principal' };
const clearTheClockLayer: CommandInput = { type: 'clearLayer', layerId: 'clock' };

/** The race clock on the PROGRAM output, taken from the start item of the endurance race. */
function buildStartItemOnProgram(): Instance {
  return {
    ...buildRaceClockInstanceOnTheClockLayer(momentTheStartWasPreviewed),
    itemId: enduranceStartItemId,
  };
}

const operatorKeyScenarios: Array<{
  name: string;
  operatorKey: OperatorKey;
  /** The item the rundown's cursor is on; null for "on nothing". */
  cursorItemId: string | null;
  /** false for a page the server has sent no rundown to. */
  isRundownOnScreen: boolean;
  instances: Instance[];
  expectedCommand: CommandInput | null;
}> = [
  // The loop the brief asks for: → previewed the start, Space sends that very preview to
  // air, on the layer it is previewed on.
  {
    name: 'Space takes the preview when it shows the cursor item',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed)],
    expectedCommand: { type: 'takePreview', layerId: 'clock' },
  },
  // "Prévia automática" switched off, or a page that never previewed: Space is what it
  // was before previews existed.
  {
    name: 'Space takes the next item when nothing is previewed',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [],
    expectedCommand: takeNextOfTheMainRundown,
  },
  // The operator previewed the yellow flag with its row's button to have a look, but the
  // cursor is still on the start. Space must fire the planned item, not the one looked at.
  {
    name: 'Space takes the next item when the preview shows another item',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildRaceClockPreviewOfItem(yellowFlagItemId, momentTheStartWasPreviewed)],
    expectedCommand: takeNextOfTheMainRundown,
  },
  // A preview from "Edição rápida" belongs to no item, so it can never be "the cursor
  // item's preview"; it is taken with its "Tomar" button.
  {
    name: 'Space takes the next item when the only preview was made by hand',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildLowerThirdPreviewMadeByHand(momentTheStartWasPreviewed)],
    expectedCommand: takeNextOfTheMainRundown,
  },
  // The cursor item is on air already (the Left arrow brought the cursor back to it) and
  // nothing is previewed. An instance on program is not a preview.
  {
    name: 'Space takes the next item when the cursor item is only on the program output',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildStartItemOnProgram()],
    expectedCommand: takeNextOfTheMainRundown,
  },
  // Two previews at once: the start on the clock layer and a band made by hand. Space
  // still finds the one made from the cursor item.
  {
    name: 'Space takes the preview of the cursor item among several previews',
    operatorKey: 'space',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [
      buildLowerThirdPreviewMadeByHand(oneMinuteLater),
      buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
    ],
    expectedCommand: { type: 'takePreview', layerId: 'clock' },
  },
  // The end of the rundown. The page still asks: the server owns the cursor and answers
  // with its pt-BR "there is no next item" (docs/decisions.md, PR #8).
  {
    name: 'Space still sends takeNext when the cursor is on nothing',
    operatorKey: 'space',
    cursorItemId: null,
    isRundownOnScreen: true,
    instances: [buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed)],
    expectedCommand: takeNextOfTheMainRundown,
  },
  // No rundown at all: takeNext needs a rundown's id, and there is none to name.
  {
    name: 'Space sends nothing while the server has sent no rundown',
    operatorKey: 'space',
    cursorItemId: null,
    isRundownOnScreen: false,
    instances: [],
    expectedCommand: null,
  },
  // "Prévia automática" is off and the operator wants to see the next item first.
  {
    name: 'Shift+Space previews the cursor item',
    operatorKey: 'shiftSpace',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [],
    expectedCommand: { type: 'previewItem', itemId: enduranceStartItemId },
  },
  // Pressed again after the item was edited: the server resolves the item anew and
  // replaces the preview, so the key is never a dead key.
  {
    name: 'Shift+Space previews the cursor item again when it is previewed already',
    operatorKey: 'shiftSpace',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed)],
    expectedCommand: { type: 'previewItem', itemId: enduranceStartItemId },
  },
  // previewItem names an item, and with the cursor on nothing there is none to name; the
  // rundown panel already says "Clique num item para posicionar o cursor".
  {
    name: 'Shift+Space sends nothing when the cursor is on nothing',
    operatorKey: 'shiftSpace',
    cursorItemId: null,
    isRundownOnScreen: true,
    instances: [],
    expectedCommand: null,
  },
  // The same key on a page with no rundown.
  {
    name: 'Shift+Space sends nothing while the server has sent no rundown',
    operatorKey: 'shiftSpace',
    cursorItemId: null,
    isRundownOnScreen: false,
    instances: [],
    expectedCommand: null,
  },
  // The everyday use: the operator looked at the preview and does not want it.
  {
    name: 'Backspace discards the one preview there is',
    operatorKey: 'backspace',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed)],
    expectedCommand: { type: 'stopPreview', layerId: 'clock' },
  },
  // Two previews: one press discards one, the one made last, which is the one the
  // operator has just been looking at. The band was previewed a minute after the clock.
  {
    name: 'Backspace discards the preview made most recently when two layers hold one',
    operatorKey: 'backspace',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [
      buildLowerThirdPreviewMadeByHand(oneMinuteLater),
      buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
    ],
    expectedCommand: { type: 'stopPreview', layerId: 'lower-third' },
  },
  // Two previews made at the very same moment: the later one in the server's list, so
  // the answer never flips between them from one press to the next.
  {
    name: 'Backspace discards the later preview in the list when two were made together',
    operatorKey: 'backspace',
    cursorItemId: enduranceStartItemId,
    isRundownOnScreen: true,
    instances: [
      buildLowerThirdPreviewMadeByHand(momentTheStartWasPreviewed),
      buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
    ],
    expectedCommand: { type: 'stopPreview', layerId: 'clock' },
  },
  // A preview and the same clock on air: Backspace touches the preview only. The clock
  // on air is safe for as long as any preview is showing.
  {
    name: 'Backspace discards the preview and leaves the program output alone',
    operatorKey: 'backspace',
    cursorItemId: yellowFlagItemId,
    isRundownOnScreen: true,
    instances: [
      buildStartItemOnProgram(),
      buildRaceClockPreviewOfItem(yellowFlagItemId, oneMinuteLater),
    ],
    expectedCommand: { type: 'stopPreview', layerId: 'clock' },
  },
  // Nothing previewed: Backspace is what it was before previews existed.
  {
    name: 'Backspace clears the clock layer when nothing is previewed',
    operatorKey: 'backspace',
    cursorItemId: yellowFlagItemId,
    isRundownOnScreen: true,
    instances: [buildStartItemOnProgram()],
    expectedCommand: clearTheClockLayer,
  },
  // Backspace needs no rundown: it was never a key of the rundown.
  {
    name: 'Backspace still clears the clock layer while the server has sent no rundown',
    operatorKey: 'backspace',
    cursorItemId: null,
    isRundownOnScreen: false,
    instances: [],
    expectedCommand: clearTheClockLayer,
  },
];

describe('chooseCommandForOperatorKey', () => {
  it.each(operatorKeyScenarios)(
    '$name',
    ({ operatorKey, cursorItemId, isRundownOnScreen, instances, expectedCommand }) => {
      // Arrange: the main rundown with its cursor where this row says, or no rundown.
      const rundown = isRundownOnScreen ? buildMainRundown(cursorItemId) : undefined;

      // Act: ask what the key sends.
      const command = chooseCommandForOperatorKey(operatorKey, rundown, instances);

      // Assert: the command of this row, or null for "nothing is sent".
      expect(command, 'the key must send exactly the command this row names, or nothing').toEqual(
        expectedCommand,
      );
    },
  );
});
