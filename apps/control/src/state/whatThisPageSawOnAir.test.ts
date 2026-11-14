/**
 * What this page showed on air, added to every take (apps/control)
 *
 * What this module is for:
 *   Two consoles may take on one layer at the same moment (BAJAOVRLAY-69). So the server can
 *   tell a take made on a stale view from one made after seeing the other console's, every
 *   take this page sends carries what the page showed on the program output of the layer it
 *   takes on: the instance id, or null for an empty layer. It is added in the page's one
 *   way of sending commands, so every take path carries it: a rundown row's "Disparar", a
 *   quick-fire button and its number key, "Salvar e disparar", a Camadas row's "Disparar" (all
 *   takeItem), Space (takeNext, or takePreview on a previewed item), "Tomar" (takePreview)
 *   and "Tomar tudo" (takeAllPreviews).
 *
 * What these tests prove, one row per case:
 *   - takeItem carries the instance on its item's layer, or null when the page shows that
 *     layer empty; a take of an item the page does not know is sent as it is.
 *   - takeNext carries the cursor's item and the instance on that item's layer; with the
 *     cursor on nothing it is sent as it is.
 *   - takePreview carries the instance on its layer.
 *   - takeAllPreviews carries, for each layer with a preview or a "vai limpar" mark, the
 *     instance on that layer's program output.
 *   - Any other command is sent untouched.
 *
 * What these tests deliberately do not cover:
 *   - That sendCommand adds it before sending: serverConnectionConsoles.test.ts.
 *   - What the server does with it: apps/server's consoles/unseenChangeByAnotherConsole.test.ts.
 */
import type { CommandInput, Slices } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildRaceClockPreviewOfItem } from './previewLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  buildSlicesWithTheEnduranceStartOnAir,
  mainRundownId,
  yellowFlagItemId,
} from './rundownLikeTheServerSends.testSupport';
import { addWhatThisPageSawOnAir } from './whatThisPageSawOnAir';

/** The id of the race clock the endurance start put on air (slicesLikeTheServerSends). */
const idOfTheClockOnAir = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

/** The start of the enduro on air on "Relógio" since 14:00, the cursor on the yellow flag. */
function buildTheStartOnAir(): Slices {
  return buildSlicesWithTheEnduranceStartOnAir('2026-10-09T14:00:00.000Z');
}

/** The same rundown, with nothing on air and the cursor on the yellow flag. */
function buildNothingOnAir(): Slices {
  return buildSlicesWithTheEnduranceRundown(yellowFlagItemId);
}

/** The start on air, the yellow flag in Prévia on "Relógio", and "Tarja" marked "vai limpar". */
function buildTheStartOnAirWithPrevia(): Slices {
  const slices = buildTheStartOnAir();
  return {
    ...slices,
    instances: [
      ...slices.instances,
      buildRaceClockPreviewOfItem(yellowFlagItemId, '2026-10-09T14:05:00.000Z'),
    ],
    previewClearedLayerIds: ['lower-third'],
  };
}

type Row = {
  name: string;
  slicesNow: Slices;
  command: CommandInput;
  expectedCommand: CommandInput;
};

const casesOfEachTakePath: Row[] = [
  {
    // "Disparar", a quick-fire button or key, "Salvar e disparar": the item's layer shows a clock.
    name: 'adds the instance on air on the layer of the item a takeItem takes',
    slicesNow: buildTheStartOnAir(),
    command: { type: 'takeItem', itemId: yellowFlagItemId },
    expectedCommand: {
      type: 'takeItem',
      itemId: yellowFlagItemId,
      instanceIdSeenOnAir: idOfTheClockOnAir,
    },
  },
  {
    // The race of the chaos scenario: the page shows the layer empty.
    name: 'adds null to a takeItem when the page shows the layer empty',
    slicesNow: buildNothingOnAir(),
    command: { type: 'takeItem', itemId: yellowFlagItemId },
    expectedCommand: { type: 'takeItem', itemId: yellowFlagItemId, instanceIdSeenOnAir: null },
  },
  {
    // An item the page does not know (deleted meanwhile): the server answers ITEM_NOT_FOUND.
    name: 'sends a takeItem of an item the page does not know as it is',
    slicesNow: buildTheStartOnAir(),
    command: { type: 'takeItem', itemId: 'item-excluido-ha-pouco' },
    expectedCommand: { type: 'takeItem', itemId: 'item-excluido-ha-pouco' },
  },
  {
    // Space: the cursor is on the yellow flag, whose layer shows the start's clock. It says
    // which cursor item it saw too, so the server refuses it if the cursor moved meanwhile.
    name: "adds the cursor's item and the instance on its layer to a takeNext",
    slicesNow: buildTheStartOnAir(),
    command: { type: 'takeNext', rundownId: mainRundownId },
    expectedCommand: {
      type: 'takeNext',
      rundownId: mainRundownId,
      cursorItemIdSeen: yellowFlagItemId,
      instanceIdSeenOnAir: idOfTheClockOnAir,
    },
  },
  {
    // Space with the cursor on nothing: the server answers RUNDOWN_CURSOR_EMPTY.
    name: 'sends a takeNext with the cursor on nothing as it is',
    slicesNow: buildSlicesWithTheEnduranceRundown(null),
    command: { type: 'takeNext', rundownId: mainRundownId },
    expectedCommand: { type: 'takeNext', rundownId: mainRundownId },
  },
  {
    // "Tomar" on "Relógio", or Space on the previewed yellow flag.
    name: 'adds the instance on air on its layer to a takePreview',
    slicesNow: buildTheStartOnAirWithPrevia(),
    command: { type: 'takePreview', layerId: 'clock' },
    expectedCommand: {
      type: 'takePreview',
      layerId: 'clock',
      instanceIdSeenOnAir: idOfTheClockOnAir,
    },
  },
  {
    // "Tomar tudo": "Relógio" has a preview over the clock, "Tarja" a mark over nothing.
    name: 'adds what is on air on each layer Prévia shows to a takeAllPreviews',
    slicesNow: buildTheStartOnAirWithPrevia(),
    command: { type: 'takeAllPreviews' },
    expectedCommand: {
      type: 'takeAllPreviews',
      instanceIdsSeenOnAir: { clock: idOfTheClockOnAir, 'lower-third': null },
    },
  },
  {
    // Not a take: nothing to add.
    name: 'sends any other command untouched',
    slicesNow: buildTheStartOnAir(),
    command: { type: 'clearLayer', layerId: 'clock' },
    expectedCommand: { type: 'clearLayer', layerId: 'clock' },
  },
];

describe('addWhatThisPageSawOnAir', () => {
  it.each(casesOfEachTakePath)('$name', ({ slicesNow, command, expectedCommand }) => {
    // Arrange: what the page shows now, from the row.

    // Act: prepare the command for sending.
    const commandToSend = addWhatThisPageSawOnAir(command, slicesNow);

    // Assert: it carries exactly what the page showed, or nothing for a command that is not a take.
    expect(commandToSend, 'the command must say what this page showed on air').toEqual(
      expectedCommand,
    );
  });
});
