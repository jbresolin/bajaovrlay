/**
 * Which race clock on air the take panel follows (apps/control)
 *
 * What this module is for:
 *   The take panel shows what the race clock on air holds and offers "Atualizar" for it.
 *   A race clock can be on any layer: an item may put it on the logo layer, for example.
 *   So the panel finds it by its graphic (`race-clock`) on the program output, whatever
 *   the layer. If two are on air at once, it follows the one taken most recently and
 *   says how many there are.
 *
 * What these tests prove:
 *   - With no race clock on the program output there is nothing to follow.
 *   - One race clock is followed on the clock layer and equally on another layer.
 *   - A race clock on the preview output, and another graphic on the clock layer, are
 *     not followed.
 *   - Of two race clocks on program on different layers, the one taken later is
 *     followed, whichever comes first in the slice; and both are counted.
 *   - Two race clocks taken at the very same moment: the later one in the slice is followed.
 *
 * What these tests deliberately do not cover:
 *   - What the panel draws for each case; TakeRaceClockPanelOnAnyLayer.test.tsx.
 *   - Reading the data the followed instance holds; raceClockDataOnAir.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findRaceClockInstanceToFollow } from './raceClockInstanceToFollow';

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
  graphicId: 'lower-third',
  target: 'program',
  takenAt: tenOClock,
});

const followScenarios: Array<{
  name: string;
  instances: Instance[];
  expectedIdFollowed: string | undefined;
  expectedNumberOfRaceClocksOnProgram: number;
}> = [
  // Before anything is taken: no "Atualizar", the form keeps its defaults.
  {
    name: 'follows nothing when nothing is on air',
    instances: [],
    expectedIdFollowed: undefined,
    expectedNumberOfRaceClocksOnProgram: 0,
  },
  // The usual case: the clock taken with "Colocar no ar" sits on the clock layer.
  {
    name: 'follows the race clock on the clock layer',
    instances: [clockOnTheClockLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-relogio',
    expectedNumberOfRaceClocksOnProgram: 1,
  },
  // João's walk: an item put the clock on the logo layer and the panel did not see it.
  {
    name: 'follows the race clock when it is on the logo layer instead',
    instances: [clockOnTheLogoLayerSinceTenOClock],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfRaceClocksOnProgram: 1,
  },
  // The preview output is not what the audience sees, so it is not "on air".
  {
    name: 'does not follow a race clock that is only on the preview output',
    instances: [clockOnThePreviewOutput],
    expectedIdFollowed: undefined,
    expectedNumberOfRaceClocksOnProgram: 0,
  },
  // The layer does not make a graphic a race clock: its data would not fit the form.
  {
    name: 'does not follow another graphic that happens to be on the clock layer',
    instances: [lowerThirdOnTheClockLayer],
    expectedIdFollowed: undefined,
    expectedNumberOfRaceClocksOnProgram: 0,
  },
  // Two clocks at once: the operator's last action is the one the panel follows.
  {
    name: 'follows the race clock taken later when two are on air, the later one last in the slice',
    instances: [clockOnTheClockLayerSinceQuarterToTen, clockOnTheLogoLayerSinceTenOClock],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfRaceClocksOnProgram: 2,
  },
  // The same two the other way round: the order in the slice must not decide.
  {
    name: 'follows the race clock taken later when two are on air, the later one first in the slice',
    instances: [clockOnTheLogoLayerSinceTenOClock, clockOnTheClockLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-logo',
    expectedNumberOfRaceClocksOnProgram: 2,
  },
  // Taken in the same instant (it cannot really happen): one fixed answer, the later
  // one in the slice, so the panel does not flip between the two.
  {
    name: 'follows the later one in the slice when two were taken at the very same moment',
    instances: [clockOnTheClockLayerSinceQuarterToTen, clockOnTheLogoLayerSinceQuarterToTen],
    expectedIdFollowed: 'relogio-na-camada-logo-mais-cedo',
    expectedNumberOfRaceClocksOnProgram: 2,
  },
];

describe('findRaceClockInstanceToFollow', () => {
  it.each(followScenarios)(
    '$name',
    ({ instances, expectedIdFollowed, expectedNumberOfRaceClocksOnProgram }) => {
      // Arrange: the instances of this row are what the server says is on air.

      // Act: ask which race clock the panel follows.
      const found = findRaceClockInstanceToFollow(instances);

      // Assert: the instance of this row, and how many race clocks are on program.
      expect(
        found.instanceToFollow?.id,
        'the panel must follow the most recently taken race clock on the program output',
      ).toBe(expectedIdFollowed);
      expect(
        found.numberOfRaceClocksOnProgram,
        'every race clock on the program output must be counted, on any layer',
      ).toBe(expectedNumberOfRaceClocksOnProgram);
    },
  );
});
