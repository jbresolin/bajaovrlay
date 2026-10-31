/**
 * The lower strip web component: school names too long for their pill (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   Each car's pill names its school after the position and the chip. Six cars a page always
 *   fit with the schools' short names (stripPages.ts), but a source may send a long one
 *   ("Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus
 *   Itaperuna"). The school cell is a scrolling box of the kit (scrollingTextWhenTooLong.ts)
 *   instead of being cut with an ellipsis: the strip runs one cycle for every pill while on
 *   air and must end it whenever it leaves the air, or its animations and timers would go on
 *   running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every school too long, the strip runs exactly one cycle for the six
 *     pills of the page, each at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every school back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll (a page turn writes new schools
 *     into the pills, which rejoin the next cycle); the kit's tests.
 *   - Real widths; jsdom measures nothing, so every school is made too long by the kit's
 *     test support. The look is the screenshots' (lowerStripScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type LowerStripGraphic from './lower-strip.js';
import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  loadLowerStripWithData,
} from './lowerStripOnThePage.testSupport.js';

/** Loads the real enduro's strip, every school too long for its pill, and takes it on air. */
async function putStripOnAirWithEverySchoolTooLong(): Promise<LowerStripGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const lowerStrip = createLowerStripOnThePage();
  await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
  await lowerStrip.playAction({ skipAnimation: true });
  return lowerStrip;
}

/** The phase each school cell on the page names, in page order. */
function readPhasesOfTheSchools(lowerStrip: LowerStripGraphic): (string | undefined)[] {
  const schools =
    lowerStrip.shadowRoot?.querySelectorAll<HTMLElement>(
      '[data-testid="lower-strip-car-school"]',
    ) ?? [];
  return [...schools].map((school) => school.dataset.scrollPhase);
}

describe('school names too long for their pill', () => {
  it('run on one cycle while on air, every pill at its start first', async () => {
    // Arrange and act: the strip on air, taken with skipAnimation as a reloaded renderer does.
    const lowerStrip = await putStripOnAirWithEverySchoolTooLong();

    // Assert: one cycle, the six schools of page 1 holding at their start.
    expect(findRunningScrollingTextCycles().length, 'the strip must run one cycle').toBe(1);
    expect(readPhasesOfTheSchools(lowerStrip), 'every school must hold at its start').toEqual(
      Array.from({ length: 6 }, () => 'holdingAtStart'),
    );
  });

  const waysOffAir = [
    // The operator takes the strip off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (lowerStrip: LowerStripGraphic) => lowerStrip.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (lowerStrip: LowerStripGraphic) => lowerStrip.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (lowerStrip: LowerStripGraphic) => {
        lowerStrip.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the strip on air, its cycle running.
    const lowerStrip = await putStripOnAirWithEverySchoolTooLong();

    // Act: the strip leaves the air this way.
    await takeOffAir(lowerStrip);

    // Assert: no cycle runs, and no school keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const schoolsWithAPhase = readPhasesOfTheSchools(lowerStrip).filter(
      (phase) => phase !== undefined,
    );
    expect(schoolsWithAPhase, 'every school must be back at its start').toEqual([]);
  });
});
