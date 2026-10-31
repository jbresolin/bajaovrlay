/**
 * The positions tower web component: names too long for their column (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   A team name with its school ("INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA
 *   FLUMINENSE - IFF - CAMPUS ITAPERUNA") is often wider than the tower's team column. The
 *   team cell is a scrolling box of the kit (scrollingTextWhenTooLong.ts): the tower runs
 *   one clock for all its rows while on air, and must end it whenever it leaves the air,
 *   or a GSAP timeline would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every name too long, the tower runs exactly one cycle for all its rows,
 *     each name at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every name back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every name is made too long by the kit's
 *     test support. positionsTowerLongNames.e2e.ts measures the real thing in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  killScrollingTextCyclesWhenTheTestEnds,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type PositionsTowerGraphic from './positions-tower.js';
import {
  createCompactTowerDataOnTheSample,
  createTowerOnThePage,
  listRowElements,
  loadTowerWithData,
} from './positionsTowerOnThePage.testSupport.js';

/** The scrolling boxes in the team cells of the rows on the page. */
function listTeamCells(tower: PositionsTowerGraphic): HTMLElement[] {
  return listRowElements(tower).map((row) => {
    const cell = row.querySelector<HTMLElement>('[data-testid="row-team-box"]');
    if (cell === null) {
      throw new Error('a tower row without its team cell');
    }
    return cell;
  });
}

/** Loads the 60-car sample, every name too long for its column, and takes it on air. */
async function putTowerOnAirWithEveryNameTooLong(): Promise<PositionsTowerGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  killScrollingTextCyclesWhenTheTestEnds();
  const tower = createTowerOnThePage();
  await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
  await tower.playAction({ skipAnimation: true });
  return tower;
}

describe('the names too long for their column', () => {
  it('run on one cycle for every row while on air, each at its start first', async () => {
    // Arrange and act: the sample on air, taken with skipAnimation as a reloaded renderer does.
    const tower = await putTowerOnAirWithEveryNameTooLong();

    // Assert: one cycle for the whole tower, every row holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the tower must run one cycle').toBe(1);
    const phases = new Set(listTeamCells(tower).map((cell) => cell.dataset.scrollPhase));
    expect([...phases], 'every row must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the tower off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (tower: PositionsTowerGraphic) => tower.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (tower: PositionsTowerGraphic) => tower.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (tower: PositionsTowerGraphic) => {
        tower.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the sample on air, its cycle running.
    const tower = await putTowerOnAirWithEveryNameTooLong();
    const teamCells = listTeamCells(tower);

    // Act: the tower leaves the air this way.
    await takeOffAir(tower);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = teamCells.filter((cell) => cell.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every name must be back at its start').toEqual([]);
  });
});
