/**
 * The race clock web component: a session name too long for the card (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The card's title is the session's name ("ENDURO DE RESISTÊNCIA — UNIVERSIDADE
 *   TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO" would not fit its 420 px). It is a
 *   scrolling box of the kit (scrollingTextWhenTooLong.ts): the clock runs its cycle while
 *   on air and must end it whenever it leaves the air, or a GSAP timeline would go on
 *   running inside OBS.
 *
 * What these tests prove:
 *   - On air, with the title too long, the clock runs exactly one cycle, the title at its
 *     start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put the title back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so the title is made too long by the kit's test
 *     support. The look is the screenshots' (raceClockScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type RaceClockGraphic from './race-clock.js';
import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  findPartOfRaceClock,
  loadRaceClockWithData,
} from './raceClockOnThePage.testSupport.js';

/** Loads the enduro's clock, its title too long for the card, and takes it on air. */
async function putRaceClockOnAirWithTheTitleTooLong(): Promise<RaceClockGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const raceClock = createRaceClockOnThePage();
  await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
  await raceClock.playAction({ skipAnimation: true });
  return raceClock;
}

/** The phase the title's box names, if any. */
function readTitlePhase(raceClock: RaceClockGraphic): string | undefined {
  return findPartOfRaceClock(raceClock, 'race-clock-session-name')?.dataset.scrollPhase;
}

describe('a session name too long for the card', () => {
  it('runs on one cycle while on air, at its start first', async () => {
    // Arrange and act: the clock on air, taken with skipAnimation as a reloaded renderer does.
    const raceClock = await putRaceClockOnAirWithTheTitleTooLong();

    // Assert: one cycle, the title holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the clock must run one cycle').toBe(1);
    expect(readTitlePhase(raceClock), 'the title must hold at its start first').toBe(
      'holdingAtStart',
    );
  });

  const waysOffAir = [
    // The operator takes the clock off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (raceClock: RaceClockGraphic) => raceClock.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (raceClock: RaceClockGraphic) => raceClock.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (raceClock: RaceClockGraphic) => {
        raceClock.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('ends with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the clock on air, its cycle running.
    const raceClock = await putRaceClockOnAirWithTheTitleTooLong();

    // Act: the clock leaves the air this way.
    await takeOffAir(raceClock);

    // Assert: no cycle runs, and the title keeps no phase (so no fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    expect(readTitlePhase(raceClock), 'the title must be back at its start').toBeUndefined();
  });
});
