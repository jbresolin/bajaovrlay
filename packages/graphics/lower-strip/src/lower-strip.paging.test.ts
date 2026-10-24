/**
 * The lower strip's pages on air: the page timer, the turns and live updates around them
 * (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   On air the strip turns its page every `--motion-strip-hold` (7 s in Ardósia), cycling
 *   through the field six cars at a time, with the kit's pageTurner. A turn draws the next
 *   page on the second lane while the first lifts away, so the bar is never empty. Live
 *   updates of the running order keep arriving all the while.
 *
 * What these tests prove (fake time decides when a hold ends):
 *   - After one hold page 2 is on air (positions 7 to 12, "2/6"), and after six holds the
 *     cycle is back on page 1; during a turn both pages are drawn, so the bar never empties.
 *   - A car that drops from page 1 to page 2 leaves page 1 at once (redrawn in place) and
 *     is on page 2 at the next turn.
 *   - An update that arrives during a turn is drawn once the turn has ended.
 *   - A field of five cars (one page) never turns; grown to seven on air, it starts.
 *   - The timer is stopped on stop, on dispose and when the element leaves the page: no
 *     page turns after any of them, however long the holds; a re-take starts on page 1.
 *
 * What these tests deliberately do not cover:
 *   - What the turn looks like; the kit's barMotion.test.ts gives its timing, and
 *     e2e/lowerStripLifecycle.e2e.ts watches a turn in Chromium.
 *   - Which cars a page holds as a rule; stripPages.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  findPartOfLowerStrip,
  loadLowerStripWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnAir,
  readPageCell,
  takeControlOfTimers,
} from './lowerStripOnThePage.testSupport.js';
import type { RealEnduroCar } from './realEnduroField.js';
import { createRealEnduroField } from './realEnduroField.js';

/** Ardósia's 7 s hold on :root; with no motion token every turn lasts 0 ms. */
function placeArdosiaStripHoldOnTheRoot(): void {
  placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms' });
}

/** The car numbers of positions 7 to 12 of the real field: page 2. */
function listCarNumbersOfPageTwo(): number[] {
  return createRealEnduroField()
    .slice(6, 12)
    .map((car) => car.carNumber);
}

/** The real field with the leader dropped to 7th, every position renumbered. */
function createFieldWithTheLeaderDroppedToSeventh(): RealEnduroCar[] {
  const [leader, ...others] = createRealEnduroField();
  if (leader === undefined) {
    return others;
  }
  const reordered = [...others.slice(0, 6), leader, ...others.slice(6)];
  return reordered.map((car, index) => ({ ...car, position: index + 1 }));
}

/** Counts the pills drawn on both lanes. */
function countPillsOnBothLanes(lowerStrip: HTMLElement): number {
  return lowerStrip.shadowRoot?.querySelectorAll('[data-testid="lower-strip-car"]').length ?? 0;
}

describe('the page timer', () => {
  it('turns to page 2 after one --motion-strip-hold', async () => {
    // Arrange: the 7 s hold, timers under the test's control, the real field on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: let one hold pass and the turn (0 ms of motion here) finish.
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: positions 7 to 12, and the page cell says so.
    expect(readCarNumbersOnAir(lowerStrip), 'page 2 is on air').toEqual(listCarNumbersOfPageTwo());
    expect(readPageCell(lowerStrip), 'the page cell reads 2/6').toBe('2/6');
  });

  it('goes through the six pages and back to page 1 after six holds', async () => {
    // Arrange: the same strip on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: let five holds pass, note page 6, then a sixth.
    await vi.advanceTimersByTimeAsync(5 * 7000);
    const pageSixCell = readPageCell(lowerStrip);
    const pageSixCarCount = readCarNumbersOnAir(lowerStrip).length;
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: page 6 held the last four cars, and the cycle came back to the leader.
    expect(pageSixCell, 'the sixth page').toBe('6/6');
    expect(pageSixCarCount, 'page 6 holds the last four cars').toBe(4);
    expect(readPageCell(lowerStrip), 'the cycle comes back to page 1').toBe('1/6');
    expect(readCarNumbersOnAir(lowerStrip)[0], 'with the leader, car 51').toBe(51);
  });
});

describe('a turn on air', () => {
  it('draws both pages during the turn, so the bar is never empty', async () => {
    // Arrange: the real field on air, its turn lasting 300 ms (on the bar itself, since
    // jsdom carries no custom property from :root into a shadow root).
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.style.setProperty(
      '--motion-strip-page',
      '300ms',
    );

    // Act: start the turn, count the pills while it runs, then let it end.
    const pendingTurn = lowerStrip.turnToTheNextPageNow();
    const pillsDuringTheTurn = countPillsOnBothLanes(lowerStrip);
    await pendingTurn;

    // Assert: twelve pills while the turn runs (page 1 lifting, page 2 rising), six after.
    expect(pillsDuringTheTurn, 'both pages are drawn while the page turns').toBe(12);
    expect(countPillsOnBothLanes(lowerStrip), 'only page 2 is left after the turn').toBe(6);
  });

  it('draws an update that arrives during a turn once the turn has ended', async () => {
    // Arrange: the real field on air, its turn lasting 300 ms.
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    findPartOfLowerStrip(lowerStrip, 'lower-strip-bar')?.style.setProperty(
      '--motion-strip-page',
      '300ms',
    );

    // Act: start the turn to page 2; meanwhile the leader drops to 7th, onto page 2.
    const pendingTurn = lowerStrip.turnToTheNextPageNow();
    const answer = await lowerStrip.updateAction({
      data: { entries: createFieldWithTheLeaderDroppedToSeventh() },
    });
    await pendingTurn;

    // Assert: the update was taken, and page 2 shows the new order with car 51 first.
    expect(answer, 'an update during a turn is taken').toEqual({ statusCode: 200 });
    expect(readCarNumbersOnAir(lowerStrip)[0], 'car 51 is now 7th, the first of page 2').toBe(51);
  });
});

describe('live updates between turns', () => {
  it('takes a car that drops to page 2 off page 1 at once, and shows it on page 2 at the next turn', async () => {
    // Arrange: the 7 s hold, timers under the test's control, page 1 on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: the leader drops to 7th, then one hold passes.
    await lowerStrip.updateAction({
      data: { entries: createFieldWithTheLeaderDroppedToSeventh() },
    });
    const pageOneAfterTheUpdate = readCarNumbersOnAir(lowerStrip);
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: page 1 lost car 51 at once; page 2 starts with it.
    expect(pageOneAfterTheUpdate.includes(51), 'car 51 has left page 1').toBe(false);
    expect(pageOneAfterTheUpdate[0], 'car 10 leads page 1 now').toBe(10);
    expect(readCarNumbersOnAir(lowerStrip)[0], 'car 51 opens page 2').toBe(51);
  });

  it('never turns a field of five cars, and starts turning once it grows to seven', async () => {
    // Arrange: the 7 s hold, timers under the test's control, five cars on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, {
      ...createRealEnduroStripData(),
      entries: createRealEnduroField().slice(0, 5),
    });
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: three holds pass; then two more cars cross the line and one hold passes.
    await vi.advanceTimersByTimeAsync(3 * 7000);
    const pageCellWithFiveCars = readPageCell(lowerStrip);
    await lowerStrip.updateAction({ data: { entries: createRealEnduroField().slice(0, 7) } });
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: one page stays put; with seven cars the strip turns to page 2.
    expect(pageCellWithFiveCars, 'five cars are one page that never turns').toBe('1/1');
    expect(readPageCell(lowerStrip), 'seven cars make two pages, and the strip turns').toBe('2/2');
  });
});

describe('the page timer stopped', () => {
  it('turns no page after stop, and a re-take starts on page 1', async () => {
    // Arrange: the real field on air, turned to page 2, then taken off.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    await vi.advanceTimersByTimeAsync(7000);
    await lowerStrip.stopAction({ skipAnimation: true });

    // Act: let three holds pass off air, then take it again.
    await vi.advanceTimersByTimeAsync(3 * 7000);
    const pageCellOffAir = readPageCell(lowerStrip);
    await lowerStrip.playAction({ skipAnimation: true });

    // Assert: off air it rests on page 1, and the re-take starts at the leader.
    expect(pageCellOffAir, 'off air the strip rests on page 1').toBe('1/6');
    expect(readCarNumbersOnAir(lowerStrip)[0], 'the re-take starts with the leader').toBe(51);
  });

  it('turns no page after dispose', async () => {
    // Arrange: the real field on air with the timer armed, then disposed.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });
    const answer = await lowerStrip.dispose();

    // Act: let three holds pass.
    await vi.advanceTimersByTimeAsync(3 * 7000);

    // Assert: dispose answered 200, and the page never changed.
    expect(answer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(readPageCell(lowerStrip), 'no page may turn after dispose').toBe('1/6');
  });

  it('turns no page once the element leaves the page while on air', async () => {
    // Arrange: the real field on air with the timer armed.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const lowerStrip = createLowerStripOnThePage();
    await loadLowerStripWithData(lowerStrip, createRealEnduroStripData());
    await lowerStrip.playAction({ skipAnimation: true });

    // Act: the renderer takes the layer out of the page without dispose; one hold passes
    // (a single hold: more would cycle and could hide a turn).
    lowerStrip.remove();
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: still page 1, so no timer is left turning a strip nobody sees.
    expect(readPageCell(lowerStrip), 'no page may turn once the strip is removed').toBe('1/6');
  });
});
