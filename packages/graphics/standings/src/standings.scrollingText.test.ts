/**
 * The standings web component: names too long for their column (packages/graphics/standings)
 *
 * What this module is for:
 *   A team with its school ("Instituto Federal de Educação, Ciência e Tecnologia Fluminense
 *   - IFF - Campus Itaperuna") and the head's event line are often wider than their box. Each
 *   is a scrolling box of the kit (scrollingTextWhenTooLong.ts): the standings run one clock
 *   for the whole board while on air, and must end it whenever the board leaves the air, or
 *   a GSAP timeline would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the board runs exactly one cycle for all its rows
 *     and its event line, each at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle and
 *     put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's test
 *     support. standingsLongNames.e2e.ts measures the real thing in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  killScrollingTextCyclesWhenTheTestEnds,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import { createOverallStandingsWithParts } from './previewData.js';
import type StandingsGraphic from './standings.js';
import {
  createStandingsOnThePage,
  listPartsOfStandings,
  loadStandingsWithData,
} from './standingsOnThePage.testSupport.js';

/** The board's scrolling boxes: every row's team box and the head's event line. */
function listScrollingBoxes(standings: StandingsGraphic): HTMLElement[] {
  const teamBoxes = listPartsOfStandings(standings, 'row-team-box');
  const eventLines = listPartsOfStandings(standings, 'standings-event-line');
  return [...teamBoxes, ...eventLines];
}

/** Loads the overall table, every text too long for its box, and takes it on air. */
async function putStandingsOnAirWithEveryTextTooLong(): Promise<StandingsGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  killScrollingTextCyclesWhenTheTestEnds();
  const standings = createStandingsOnThePage();
  await loadStandingsWithData(standings, createOverallStandingsWithParts());
  await standings.playAction({ skipAnimation: true });
  return standings;
}

describe('the texts too long for their box', () => {
  it('run on one cycle for the whole board while on air, each at its start first', async () => {
    // Arrange and act: the overall table on air, taken with skipAnimation as a reloaded
    // renderer does.
    const standings = await putStandingsOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole board, every row and the event line at their start.
    expect(findRunningScrollingTextCycles().length, 'the board must run one cycle').toBe(1);
    const boxes = listScrollingBoxes(standings);
    expect(boxes.length, 'the rows and the event line must be scrolling boxes').toBeGreaterThan(1);
    const phases = new Set(boxes.map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the board off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (standings: StandingsGraphic) => standings.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (standings: StandingsGraphic) => standings.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (standings: StandingsGraphic) => {
        standings.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the overall table on air, its cycle running.
    const standings = await putStandingsOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(standings);

    // Act: the board leaves the air this way.
    await takeOffAir(standings);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
