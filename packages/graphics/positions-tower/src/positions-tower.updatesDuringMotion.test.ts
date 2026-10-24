/**
 * The positions tower web component: updates that arrive during a motion
 * (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The live binding does not wait for the tower's animations: a new list can arrive
 *   while a page is turning (the rows lifting out, or the next page's rows rising in)
 *   or while the tower is still playing in, and the operator can switch the layout or
 *   hold the first page at those moments too. Nothing sent then may be lost, and no
 *   motion on air may be cut short to make room for it.
 *
 * What these tests prove:
 *   - A new list that arrives while the new page's rows are rising in is applied once
 *     the turn has ended (the latest one, never dropped).
 *   - A layout switch at that moment writes the cells it creates at once, so no gap or
 *     lap cell is left empty.
 *   - "Só os 20 primeiros" asked during a turn brings page 1 back once the turn has
 *     ended (the request is queued, never dropped).
 *   - An update during the play-in is applied at once and the cascade goes on to its
 *     end; it is never finished early to measure settled rows.
 *   Each test checks that its update really landed during the motion (the rows were
 *   still invisible), so a slow machine cannot make it pass for the wrong reason.
 *
 * What these tests deliberately do not cover:
 *   - Updates outside a motion, which positions-tower.updateAction.test.ts covers.
 *   - The motions themselves; jsdom lays nothing out and the tokens here are brief, so
 *     only the order of events is watched. e2e/ watches the motion in Chromium.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  briefMotionTokenDeclarations,
  createCompactTowerDataOnTheSample,
  createEnduroSampleEntries,
  createHeldCompactTowerDataOnTheSample,
  createTowerOnThePage,
  listRowElements,
  loadTowerWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnThePage,
  readRowCellText,
  swapCarsAtPositions,
  waitUntilCarIsOnThePage,
} from './positionsTowerOnThePage.testSupport.js';

/** The sample one lap later: every car has completed one more lap. */
function createEnduroSampleEntriesOneLapLater() {
  return createEnduroSampleEntries().map((entry) => ({ ...entry, laps: entry.laps + 1 }));
}

/**
 * Starts a page turn on a cycling tower on air and waits until page 2's rows are on the
 * page and rising in (the turn's second half), so the test can send something during it.
 * The wait watches the DOM (not a poll, which could wake up after the rise-in has
 * ended), and the result says whether the rows were still invisible at that moment, so
 * each test can prove its update really landed during the turn. Brief motion tokens
 * make the lift 30 ms and the rise about 340 ms.
 */
async function startATurnAndWaitForTheRiseIn(tower: ReturnType<typeof createTowerOnThePage>) {
  placeTokensOnTheRoot(briefMotionTokenDeclarations);
  await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
  await tower.playAction({ skipAnimation: true });
  const pendingTurn = tower.turnToTheNextPageNow();
  await waitUntilCarIsOnThePage(tower, 6);
  const firstRowOpacity = (listRowElements(tower)[0] as HTMLElement).style.opacity;
  const wereRowsStillRisingWhenTheTurnWasSeen = firstRowOpacity !== '1';
  return { pendingTurn, wereRowsStillRisingWhenTheTurnWasSeen };
}

describe('an update that arrives during a page turn', () => {
  it('applies a new list that arrives during the rise-in once the turn has ended', async () => {
    // Arrange: a turn to page 2 in progress, its rows rising in.
    const tower = createTowerOnThePage();
    const { pendingTurn, wereRowsStillRisingWhenTheTurnWasSeen } =
      await startATurnAndWaitForTheRiseIn(tower);

    // Act: the timing system reports one more lap for every car while the rows rise;
    // then the turn ends.
    const answer = await tower.updateAction({
      data: { entries: createEnduroSampleEntriesOneLapLater() },
    });
    await pendingTurn;

    // Assert: the update answered 200 and car 6 (first on page 2) reads its new lap
    // count: the list that arrived during the turn was kept and applied, not dropped.
    expect(wereRowsStillRisingWhenTheTurnWasSeen, 'the update was sent during the rise-in').toBe(
      true,
    );
    expect(answer, 'an update during a turn must answer 200').toEqual({ statusCode: 200 });
    await vi.waitFor(() => {
      expect(
        readRowCellText(listRowElements(tower)[0] as HTMLElement, 'row-laps'),
        'the laps sent during the turn must be on the page once the turn has ended',
      ).toBe('31');
    });
    expect(readCarNumbersOnThePage(tower)[0], 'the tower must still be on page 2').toBe(6);
  });

  it('fills the gap and lap cells at once when the layout is switched during the rise-in', async () => {
    // Arrange: a turn to page 2 in progress, its rows rising in.
    const tower = createTowerOnThePage();
    const { pendingTurn, wereRowsStillRisingWhenTheTurnWasSeen } =
      await startATurnAndWaitForTheRiseIn(tower);

    // Act: the operator switches to the detailed layout while the rows rise.
    await tower.updateAction({ data: { layout: 'detailed' } });
    const rowOfCar6 = listRowElements(tower)[0] as HTMLElement;
    const cellsRightAfterTheSwitch = {
      gap: readRowCellText(rowOfCar6, 'row-gap'),
      laps: readRowCellText(rowOfCar6, 'row-laps'),
    };
    await pendingTurn;

    // Assert: the switch came during the rise-in, and the cells it created were written
    // at once from the car's entry (car 6 is four laps down with 30 laps), never left empty.
    expect(wereRowsStillRisingWhenTheTurnWasSeen, 'the switch was sent during the rise-in').toBe(
      true,
    );
    expect(cellsRightAfterTheSwitch, 'new cells must be written as soon as they are made').toEqual({
      gap: '+4 voltas',
      laps: '30',
    });
  });

  it('brings page 1 back once the turn has ended when "Só os 20 primeiros" arrives during it', async () => {
    // Arrange: a turn to page 2 in progress, its rows rising in.
    const tower = createTowerOnThePage();
    const { pendingTurn, wereRowsStillRisingWhenTheTurnWasSeen } =
      await startATurnAndWaitForTheRiseIn(tower);

    // Act: the operator holds the top 20 while the rows rise; then the turn ends.
    await tower.updateAction({ data: { paging: 'firstPageOnly' }, skipAnimation: true });
    await pendingTurn;

    // Assert: the request came during the rise-in, and page 1 is on air (the request
    // was queued, not dropped) and stays.
    expect(wereRowsStillRisingWhenTheTurnWasSeen, 'the request was sent during the rise-in').toBe(
      true,
    );
    await vi.waitFor(() => {
      expect(
        readCarNumbersOnThePage(tower)[0],
        'firstPageOnly asked during a turn must bring page 1 back once the turn has ended',
      ).toBe(31);
    });
    expect(readCarNumbersOnThePage(tower), 'page 1 must hold its 20 rows').toHaveLength(20);
  });
});

describe('an update during the play-in', () => {
  it('is applied at once and leaves the cascade running to its end', async () => {
    // Arrange: brief motion tokens (the play-in lasts about 340 ms), a loaded tower
    // whose play-in has just started; whether the play-in has ended is noted as it does.
    placeTokensOnTheRoot(briefMotionTokenDeclarations);
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    let hasPlayInEnded = false;
    const pendingPlay = tower.playAction({}).then((answer) => {
      hasPlayInEnded = true;
      return answer;
    });
    const rowOfCar78 = listRowElements(tower)[3];

    // Act: 78 passes 25 while the rows are still rising in.
    await tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 3, 4) },
    });
    const hadPlayInEndedWhenTheUpdateResolved = hasPlayInEnded;
    const rowInSlotThreeAfterTheUpdate = listRowElements(tower)[2];
    const playAnswer = await pendingPlay;

    // Assert: the update resolved while the play-in was still running (the cascade was
    // not cut short), the rows were already in the new order, and the play-in ended on
    // its own with the tower on air.
    expect(
      hadPlayInEndedWhenTheUpdateResolved,
      'an update during the play-in must not finish the cascade early',
    ).toBe(false);
    expect(rowInSlotThreeAfterTheUpdate, 'the update must be applied at once').toBe(rowOfCar78);
    expect(playAnswer, 'the play-in must end on its own with step 0 on air').toEqual({
      statusCode: 200,
      currentStep: 0,
    });
  });
});
