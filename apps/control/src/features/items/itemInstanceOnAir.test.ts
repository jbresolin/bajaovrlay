/**
 * Item editor: which instance on air belongs to the item being edited (apps/control)
 *
 * What this module is for:
 *   When an item is taken, the server puts an instance on air that remembers the item's
 *   id. While that instance is on the program output the item editor offers "Atualizar no
 *   ar", which changes what the audience sees without a new take.
 *   findInstanceOfItemOnProgram answers which instance that button would change.
 *
 * What these tests prove:
 *   - With nothing on air, or only instances of other items or taken by hand, there is
 *     no instance for the item.
 *   - The item's instance on the program output is found, on whatever layer it is.
 *   - The item's instance on the preview output does not count: nobody sees it.
 *   - When the item is on air twice, the instance taken most recently is the one,
 *     whichever comes first in the slice; taken at the very same moment, the later one
 *     in the slice.
 *
 * What these tests deliberately do not cover:
 *   - The button and the commands it sends: ItemEditorPanelUpdateOnAir.test.tsx.
 *   - An instance whose item was deleted: it still carries the id, but no editor can be
 *     open for an item that is gone.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findInstanceOfItemOnProgram } from './itemInstanceOnAir';
import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildInterviewLowerThirdItem,
} from './itemsLikeTheEditorSaves.testSupport';

const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

const enduranceStartItem = buildEnduranceStartClockItem();
const idOfTheEnduranceStartItem = enduranceStartItem.id;

const startClockOnTheClockLayerSinceQuarterToTen = buildInstanceTakenFromItem({
  id: 'largada-na-camada-relogio',
  item: enduranceStartItem,
  layerId: 'clock',
  target: 'program',
  takenAt: quarterToTen,
});
const startClockOnTheLogoLayerSinceTenOClock = buildInstanceTakenFromItem({
  id: 'largada-na-camada-logo',
  item: enduranceStartItem,
  layerId: 'bug',
  target: 'program',
  takenAt: tenOClock,
});
const startClockOnTheLogoLayerSinceQuarterToTen = buildInstanceTakenFromItem({
  id: 'largada-na-camada-logo-mais-cedo',
  item: enduranceStartItem,
  layerId: 'bug',
  target: 'program',
  takenAt: quarterToTen,
});
const startClockOnThePreviewOutput = buildInstanceTakenFromItem({
  id: 'largada-na-previa',
  item: enduranceStartItem,
  layerId: 'clock',
  target: 'preview',
  takenAt: tenOClock,
});
const lowerThirdOfAnotherItem = buildInstanceTakenFromItem({
  id: 'tarja-da-equipe-42',
  item: buildInterviewLowerThirdItem(),
  layerId: 'lower-third',
  target: 'program',
  takenAt: tenOClock,
});
/** The race clock put on air by hand from "Edição rápida": it belongs to no item. */
const raceClockTakenByHand: Instance = {
  id: 'relogio-colocado-a-mao',
  layerId: 'clock',
  graphicId: 'race-clock',
  target: 'program',
  resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
  currentStep: 0,
  status: 'on-air',
  takenAt: tenOClock,
};

const scenariosOfTheEnduranceStartItem: Array<{
  name: string;
  instances: Instance[];
  expectedInstanceId: string | undefined;
}> = [
  // Before the session: the item is prepared and nothing was taken yet.
  { name: 'finds nothing when nothing is on air', instances: [], expectedInstanceId: undefined },
  // The usual case: the item was fired from the rundown and is on its own layer.
  {
    name: 'finds the instance taken from the item on the program output',
    instances: [startClockOnTheClockLayerSinceQuarterToTen],
    expectedInstanceId: 'largada-na-camada-relogio',
  },
  // Another item on air must never be changed by this item's editor.
  {
    name: 'does not find an instance taken from another item',
    instances: [lowerThirdOfAnotherItem],
    expectedInstanceId: undefined,
  },
  // The same graphic on air, but taken by hand: it has no item, so it is not this item's.
  {
    name: 'does not find the same graphic taken by hand, which belongs to no item',
    instances: [raceClockTakenByHand],
    expectedInstanceId: undefined,
  },
  // The preview output is not what the audience sees, so it is not "on air".
  {
    name: 'does not find the instance when it is only on the preview output',
    instances: [startClockOnThePreviewOutput],
    expectedInstanceId: undefined,
  },
  // The item among other things on air: only its own instance is the answer.
  {
    name: 'finds the instance of the item among instances that are not its own',
    instances: [
      lowerThirdOfAnotherItem,
      startClockOnTheClockLayerSinceQuarterToTen,
      raceClockTakenByHand,
    ],
    expectedInstanceId: 'largada-na-camada-relogio',
  },
  // The item on air twice. It should not happen (an item has one layer, and a second take
  // replaces the first), but nothing in the slice forbids it, so the answer is fixed: the
  // operator's last take is the one to change.
  {
    name: 'finds the instance taken later when the item is on air twice, the later one last in the slice',
    instances: [startClockOnTheClockLayerSinceQuarterToTen, startClockOnTheLogoLayerSinceTenOClock],
    expectedInstanceId: 'largada-na-camada-logo',
  },
  // The same two the other way round: the order in the slice must not decide.
  {
    name: 'finds the instance taken later when the item is on air twice, the later one first in the slice',
    instances: [startClockOnTheLogoLayerSinceTenOClock, startClockOnTheClockLayerSinceQuarterToTen],
    expectedInstanceId: 'largada-na-camada-logo',
  },
  // Taken in the same instant (it cannot really happen): one fixed answer, the later one
  // in the slice, so the button does not flip between the two.
  {
    name: 'finds the later one in the slice when two were taken at the very same moment',
    instances: [
      startClockOnTheClockLayerSinceQuarterToTen,
      startClockOnTheLogoLayerSinceQuarterToTen,
    ],
    expectedInstanceId: 'largada-na-camada-logo-mais-cedo',
  },
];

describe('findInstanceOfItemOnProgram', () => {
  it.each(scenariosOfTheEnduranceStartItem)('$name', ({ instances, expectedInstanceId }) => {
    // Arrange: the instances of this row are what the server says is on air.

    // Act: ask which instance belongs to the endurance start item.
    const instanceOfTheItem = findInstanceOfItemOnProgram(instances, idOfTheEnduranceStartItem);

    // Assert: the instance of this row, or none.
    expect(
      instanceOfTheItem?.id,
      'the answer must be the most recently taken instance of this item on the program output',
    ).toBe(expectedInstanceId);
  });
});
