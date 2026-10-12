/**
 * Which instance on air "Edição rápida" follows (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" shows what the chosen graphic holds on air and offers "Atualizar" for
 *   it. A graphic can be on any layer: a rundown item may put the race clock on the logo
 *   layer, for example. So the panel finds the graphic by its id on the program output,
 *   whatever the layer. If it is on air twice, the panel follows the one taken most
 *   recently and says how many there are.
 *
 * What these tests prove:
 *   - With the chosen graphic not on the program output there is nothing to follow.
 *   - One instance is followed on the graphic's own layer and equally on another layer.
 *   - An instance on the preview output, and another graphic on the same layer, are not
 *     followed.
 *   - Of two instances on program on different layers, the one taken later is followed,
 *     whichever comes first in the slice; and both are counted.
 *   - Two instances taken at the very same moment: the later one in the slice is followed.
 *   - The rule is the same for any graphic: asked about the lower third, the answer is
 *     the lower third, with the race clocks around it left out.
 *
 * What these tests deliberately do not cover:
 *   - What the panel draws for each case; QuickEditPanelOnAnyLayer.test.tsx.
 *   - Reading the data the followed instance holds; features/schemaForm does that.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findInstanceOfGraphicToFollow } from './instanceOfGraphicToFollow';

const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

/** What makes one instance different from another in these tests. */
type InstanceDescription = {
  id: string;
  layerId: string;
  graphicId: string;
  target: 'program' | 'preview';
  takenAt: string;
};

/** An instance on air as the server sends it, holding the first heat under green. */
function buildInstanceOnAir(description: InstanceDescription): Instance {
  return {
    ...description,
    resolvedData: { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
    currentStep: 0,
    status: 'on-air',
  };
}

const clockOnTheClockLayerSinceQuarterToTen = buildInstanceOnAir({
  id: 'relogio-na-camada-relogio',
  layerId: 'clock',
  graphicId: 'race-clock',
  target: 'program',
  takenAt: quarterToTen,
});
const clockOnTheLogoLayerSinceTenOClock = buildInstanceOnAir({
  id: 'relogio-na-camada-logo',
  layerId: 'bug',
  graphicId: 'race-clock',
  target: 'program',
  takenAt: tenOClock,
});
const clockOnTheLogoLayerSinceQuarterToTen = buildInstanceOnAir({
  id: 'relogio-na-camada-logo-mais-cedo',
  layerId: 'bug',
  graphicId: 'race-clock',
  target: 'program',
  takenAt: quarterToTen,
});
const clockOnThePreviewOutput = buildInstanceOnAir({
  id: 'relogio-na-previa',
  layerId: 'clock',
  graphicId: 'race-clock',
  target: 'preview',
  takenAt: tenOClock,
});
const lowerThirdOnTheClockLayer = buildInstanceOnAir({
  id: 'tarja-na-camada-relogio',
  layerId: 'clock',
  graphicId: 'lower-third-fixture',
  target: 'program',
  takenAt: tenOClock,
});

const followScenarios: Array<{
  name: string;
  chosenGraphicId: string;
  instances: Instance[];
  expectedIdFollowed: string | undefined;
  expectedNumberOfInstancesOnProgram: number;
}> = [
  // Before anything is taken: no "Atualizar", the form keeps its starting values.
  {
    name: 'follows nothing when nothing is on air',
    chosenGraphicId: 'race-clock',
    instances: [],
    expectedIdFollowed: undefined,
    expectedNumberOfInstancesOnProgram: 0,
  },
  // The usual case: the clock taken with "Colocar no ar" sits on its own layer.
  {
    name: 'follows the race clock on the clock layer',
    chosenGraphicId: 'race-clock',
    instances: [clockOnTheClockLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-relogio',
    expectedNumberOfInstancesOnProgram: 1,
  },
  // João's walk of BAJAOVRLAY-13: an item put the clock on the logo layer and the panel
  // did not see it.
  {
    name: 'follows the race clock when it is on the logo layer instead',
    chosenGraphicId: 'race-clock',
    instances: [clockOnTheLogoLayerSinceTenOClock],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfInstancesOnProgram: 1,
  },
  // The preview output is not what the audience sees, so it is not "on air".
  {
    name: 'does not follow a race clock that is only on the preview output',
    chosenGraphicId: 'race-clock',
    instances: [clockOnThePreviewOutput],
    expectedIdFollowed: undefined,
    expectedNumberOfInstancesOnProgram: 0,
  },
  // The layer does not decide which graphic it is: another graphic's data would not fit
  // the chosen graphic's form.
  {
    name: 'does not follow another graphic that happens to be on the clock layer',
    chosenGraphicId: 'race-clock',
    instances: [lowerThirdOnTheClockLayer],
    expectedIdFollowed: undefined,
    expectedNumberOfInstancesOnProgram: 0,
  },
  // Two at once: the operator's last action is the one the panel follows.
  {
    name: 'follows the race clock taken later when two are on air, the later one last in the slice',
    chosenGraphicId: 'race-clock',
    instances: [clockOnTheClockLayerSinceQuarterToTen, clockOnTheLogoLayerSinceTenOClock],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfInstancesOnProgram: 2,
  },
  // The same two the other way round: the order in the slice must not decide.
  {
    name: 'follows the race clock taken later when two are on air, the later one first in the slice',
    chosenGraphicId: 'race-clock',
    instances: [clockOnTheLogoLayerSinceTenOClock, clockOnTheClockLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfInstancesOnProgram: 2,
  },
  // Taken in the same instant (it cannot really happen): one fixed answer, the later
  // one in the slice, so the panel does not flip between the two.
  {
    name: 'follows the later one in the slice when two were taken at the very same moment',
    chosenGraphicId: 'race-clock',
    instances: [clockOnTheClockLayerSinceQuarterToTen, clockOnTheLogoLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-logo-mais-cedo',
    expectedNumberOfInstancesOnProgram: 2,
  },
  // The rule knows no graphic by name: with the lower third chosen, the two race clocks
  // on air are neither followed nor counted.
  {
    name: 'follows the lower third, and counts only it, when the lower third is the chosen graphic',
    chosenGraphicId: 'lower-third-fixture',
    instances: [
      clockOnTheClockLayerSinceQuarterToTen,
      lowerThirdOnTheClockLayer,
      clockOnTheLogoLayerSinceTenOClock,
    ],
    expectedIdFollowed: 'tarja-na-camada-relogio',
    expectedNumberOfInstancesOnProgram: 1,
  },
];

describe('findInstanceOfGraphicToFollow', () => {
  it.each(followScenarios)(
    '$name',
    ({ chosenGraphicId, instances, expectedIdFollowed, expectedNumberOfInstancesOnProgram }) => {
      // Arrange: the instances of this row are what the server says is on air.

      // Act: ask which instance of the chosen graphic the panel follows.
      const found = findInstanceOfGraphicToFollow(instances, chosenGraphicId);

      // Assert: the instance of this row, and how many of that graphic are on program.
      expect(
        found.instanceToFollow?.id,
        'the panel must follow the most recently taken instance of the chosen graphic on the program output',
      ).toBe(expectedIdFollowed);
      expect(
        found.numberOfInstancesOnProgram,
        'every instance of the chosen graphic on the program output must be counted, on any layer',
      ).toBe(expectedNumberOfInstancesOnProgram);
    },
  );
});
