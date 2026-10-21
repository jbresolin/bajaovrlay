/**
 * The positions tower web component: updateAction (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The live binding sends the tower a new list about every 2 s, and the operator may
 *   change its layout, its columns or its paging with "Atualizar no ar". An update is
 *   accepted at any time after load, on air or off, and refused only before load. On
 *   air the rows never get rebuilt: a car keeps its row node and slides to its new slot,
 *   a car arriving gets a new row, a car leaving has its row taken away.
 *
 * What these tests prove:
 *   - updateAction before load answers 409 with a pt-BR message, without throwing.
 *   - An update while loaded but off air answers 200 and its data is what the next
 *     play shows.
 *   - A bad update answers 400 naming the field and leaves the previous list on air.
 *   - Two cars trading places keep their row nodes, change order, take the position
 *     number of the slot they are now in, show the ▲ / ▼ and the coloured cell, and the
 *     cues are cleared after `--motion-cue-hold`.
 *   - A new leader takes the leader mark on the row now in slot 1; the old leader loses it.
 *   - A car crossing the page boundary (21st to 20th) gets a new row, the car pushed off
 *     the page has its row removed once the update resolves, and the row count stays 20.
 *   - Over many updates the row nodes are reused: the same 20 elements after 20 swaps.
 *   - A layout change on air keeps the same row nodes, adds the detailed cells to each
 *     and writes the detailed grid and width on the tower; switching a column off takes
 *     its cells away.
 *   - A page turn on air (as the timer asks) shows the next 20 cars on new rows while
 *     the head stays the same node; paging switched to firstPageOnly brings page 1 back.
 *
 * What these tests deliberately do not cover:
 *   - The FLIP slide, the rise and the lift themselves; jsdom lays nothing out, so every
 *     measured shift is 0 here. e2e/positionsTowerUpdates.e2e.ts watches them in Chromium.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createCompactTowerDataOnTheSample,
  createEnduroSampleEntries,
  createFirstCarsOfTheEnduroSample,
  createHeldCompactTowerDataOnTheSample,
  createTowerOnThePage,
  findPartOfTower,
  listRowElements,
  listRowElementsInFlow,
  loadTowerWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnThePage,
  readRowCellText,
  swapCarsAtPositions,
} from './positionsTowerOnThePage.testSupport.js';

describe('updateAction before load', () => {
  it('answers 409 with a pt-BR message, without throwing', async () => {
    // Arrange: a tower on the page that was never loaded.
    const tower = createTowerOnThePage();

    // Act: try to send it a list.
    const answer = await tower.updateAction({ data: { entries: createEnduroSampleEntries() } });

    // Assert: a 409 saying the tower is not loaded yet.
    expect(answer, 'update before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A torre ainda não foi carregada (load).',
    });
  });
});

describe('updateAction while loaded but off air', () => {
  it('accepts a new list before the first play, and play then shows it', async () => {
    // Arrange: a loaded tower that has not been played yet.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());

    // Act: car 38 takes the lead before the tower goes on air, then play.
    const updateAnswer = await tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 1, 2) },
    });
    await tower.playAction({ skipAnimation: true });

    // Assert: the update answered 200 and the tower comes on air with car 38 first.
    expect(updateAnswer, 'an update before play must answer 200').toEqual({ statusCode: 200 });
    expect(readCarNumbersOnThePage(tower).slice(0, 2), 'car 38 must lead on air').toEqual([38, 31]);
  });
});

describe('a bad update on air', () => {
  it('answers 400 naming the field and keeps the previous list on air', async () => {
    // Arrange: a tower on air with the sample.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: send a list whose third car has no laps.
    const entriesWithoutLaps = createEnduroSampleEntries().map((entry, index) =>
      index === 2 ? { ...entry, laps: undefined } : entry,
    );
    const answer = await tower.updateAction({ data: { entries: entriesWithoutLaps } });

    // Assert: a 400 naming the entry's field, and the list is unchanged.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Falta o campo obrigatório "entries[2].laps".',
    });
    expect(readCarNumbersOnThePage(tower)[0], 'the previous list must stay on air').toBe(31);
  });
});

describe('two cars trading places on air', () => {
  it('keeps their row nodes, changes their order and gives each the number of its new slot', async () => {
    // Arrange: a tower on air; the rows of cars 25 (3rd) and 78 (4th) noted.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const rowsBefore = listRowElements(tower);
    const rowOfCar25 = rowsBefore[2];
    const rowOfCar78 = rowsBefore[3];

    // Act: the timing system reports 78 ahead of 25.
    const answer = await tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 3, 4) },
    });
    const rowsAfter = listRowElements(tower);

    // Assert: 200; the same two nodes, now in the other order, each reading its slot's
    // number; the leader's node untouched.
    expect(answer, 'the swap must answer 200').toEqual({ statusCode: 200 });
    expect(rowsAfter[2], 'slot 3 must now hold the node of car 78').toBe(rowOfCar78);
    expect(rowsAfter[3], 'slot 4 must now hold the node of car 25').toBe(rowOfCar25);
    expect(readRowCellText(rowOfCar78 as HTMLElement, 'row-pos'), 'car 78 reads 3').toBe('3');
    expect(readRowCellText(rowOfCar25 as HTMLElement, 'row-pos'), 'car 25 reads 4').toBe('4');
    expect(rowsAfter[0], 'the leader keeps its node').toBe(rowsBefore[0]);
  });

  it('shows the ▲ on the car that went up and the ▼ on the car that went down, then clears both after the hold', async () => {
    // Arrange: a short cue hold on :root (the real one is 2 s), a tower on air.
    placeTokensOnTheRoot({ '--motion-cue-hold': '40ms' });
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: 78 passes 25; read the cues as soon as the update has moved the rows (the
    // rows move before the update's motion runs, and the cues go up with them).
    const pendingUpdate = tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 3, 4) },
    });
    const rows = listRowElements(tower);
    const rowOfCar78 = rows[2] as HTMLElement;
    const rowOfCar25 = rows[3] as HTMLElement;
    const cuesAsTheUpdateStarted = {
      up: rowOfCar78.classList.contains('is-up'),
      upArrowName: rowOfCar78.querySelector('svg.cue')?.getAttribute('aria-label'),
      down: rowOfCar25.classList.contains('is-down'),
      downArrowName: rowOfCar25.querySelector('svg.cue')?.getAttribute('aria-label'),
    };
    await pendingUpdate;

    // Assert: both cues are shown with their arrows, and gone once the hold has passed.
    expect(cuesAsTheUpdateStarted, 'the climber shows ▲, the other ▼').toEqual({
      up: true,
      upArrowName: 'Subiu',
      down: true,
      downArrowName: 'Desceu',
    });
    await vi.waitFor(() => {
      expect(rowOfCar78.classList.contains('is-up'), 'the ▲ must be cleared after the hold').toBe(
        false,
      );
    });
    expect(rowOfCar25.classList.contains('is-down'), 'the ▼ must be cleared with it').toBe(false);
    expect(
      rowOfCar78.querySelector('svg.cue'),
      'the arrow must be taken out of the lane',
    ).toBeNull();
  });
});

describe('a new leader', () => {
  it('moves the leader mark to the row now in slot 1', async () => {
    // Arrange: a tower on air; the rows of cars 31 (leader) and 38 (2nd) noted.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const [rowOfCar31, rowOfCar38] = listRowElements(tower);

    // Act: car 38 takes the lead.
    await tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 1, 2) },
    });

    // Assert: 38's row carries the mark, 31's no longer does, and 38's row is first.
    expect(rowOfCar38?.hasAttribute('data-leader'), 'car 38 must take the leader mark').toBe(true);
    expect(rowOfCar31?.hasAttribute('data-leader'), 'car 31 must lose the leader mark').toBe(false);
    expect(listRowElements(tower)[0], 'the new leader sits in slot 1').toBe(rowOfCar38);
  });
});

describe('a car crossing the page boundary', () => {
  it('gives the arriving car a new row, removes the row of the car pushed off, and keeps 20 rows', async () => {
    // Arrange: a tower on air with page 1; car 71 is 20th and car 6 is 21st.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const rowOfCar71 = listRowElements(tower)[19];

    // Act: car 6 climbs to 20th; car 71 drops to 21st.
    await tower.updateAction({
      data: { entries: swapCarsAtPositions(createEnduroSampleEntries(), 20, 21) },
    });
    const rowsAfter = listRowElements(tower);

    // Assert: slot 20 is a row for car 6, car 71's row is gone from the page, 20 rows.
    expect(rowsAfter[19]?.dataset.carNumber, 'slot 20 must now be car 6').toBe('6');
    expect(rowOfCar71?.isConnected, 'car 71’s row must be removed once the update resolved').toBe(
      false,
    );
    expect(rowsAfter, 'the page must still hold 20 rows').toHaveLength(20);
  });
});

describe('many updates on air', () => {
  it('reuses the same 20 row nodes across 20 swaps', async () => {
    // Arrange: a tower on air; the 20 row nodes noted.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const nodesAtTheStart = new Set(listRowElements(tower));

    // Act: 20 updates, each trading the places of two cars of page 1.
    let entries = createEnduroSampleEntries();
    for (let updateIndex = 0; updateIndex < 20; updateIndex += 1) {
      const upperPosition = (updateIndex % 19) + 1;
      entries = swapCarsAtPositions(entries, upperPosition, upperPosition + 1);
      await tower.updateAction({ data: { entries } });
    }
    const nodesAtTheEnd = listRowElements(tower);

    // Assert: still 20 rows, and every one of them is a node that was there at the start.
    expect(nodesAtTheEnd, 'the page must still hold 20 rows').toHaveLength(20);
    expect(
      nodesAtTheEnd.every((node) => nodesAtTheStart.has(node)),
      'every row node must be one created at load, never a rebuilt one',
    ).toBe(true);
  });
});

describe('a layout or column change on air', () => {
  it('switches to detailed on the same row nodes, adding the detailed cells and the grid', async () => {
    // Arrange: a compact tower on air; its row nodes and their cell counts noted.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const rowsBefore = listRowElements(tower);
    const cellCountBefore = rowsBefore[0]?.querySelectorAll('.cell').length;

    // Act: the operator switches to the detailed layout.
    const answer = await tower.updateAction({ data: { layout: 'detailed' }, skipAnimation: true });
    const rowsAfter = listRowElements(tower);
    const towerElement = findPartOfTower(tower, 'positions-tower');

    // Assert: 200; the same nodes; 6 cells became 11 (the five timing columns and the
    // status); the tower is marked detailed and carries its grid and width.
    expect(answer, 'the layout change must answer 200').toEqual({ statusCode: 200 });
    expect(rowsAfter, 'the row nodes must be the same after the layout change').toEqual(rowsBefore);
    expect(cellCountBefore, 'a compact row has six cells').toBe(6);
    expect(rowsAfter[0]?.querySelectorAll('.cell').length, 'a detailed row has eleven cells').toBe(
      11,
    );
    expect(towerElement?.dataset.layout, 'the tower must be marked detailed').toBe('detailed');
    expect(
      towerElement?.style.getPropertyValue('--tower-width'),
      'the detailed width must be written from the tokens',
    ).toContain('var(--col-gap)');
    expect(
      readRowCellText(rowsAfter[1] as HTMLElement, 'row-gap'),
      'the new gap cell must read the second car’s gap',
    ).toBe('+19,0');
  });

  it('takes a column’s cells away when it is switched off', async () => {
    // Arrange: a detailed tower on air.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, {
      ...createHeldCompactTowerDataOnTheSample(),
      layout: 'detailed',
    });
    await tower.playAction({ skipAnimation: true });

    // Act: the operator turns the best-lap column off.
    await tower.updateAction({ data: { showBestLap: false }, skipAnimation: true });
    const firstRow = listRowElements(tower)[0];

    // Assert: no best-lap cell is left, the last-lap cell is still there.
    expect(
      firstRow?.querySelector('[data-testid="row-bestLap"]'),
      'MELHOR must be gone',
    ).toBeNull();
    expect(
      firstRow?.querySelector('[data-testid="row-lastLap"]'),
      'ÚLT. VOLTA must still be there',
    ).not.toBeNull();
  });
});

describe('page turns', () => {
  it('shows cars 21 to 40 on new rows after a turn, with the same head', async () => {
    // Arrange: a tower on air with the sample; the head noted.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createHeldCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const headBefore = findPartOfTower(tower, 'positions-tower-head');
    const rowsBefore = new Set(listRowElements(tower));

    // Act: turn the page as the timer does after its hold.
    await tower.turnToTheNextPageNow();
    const rowsAfter = listRowElements(tower);

    // Assert: 20 new rows, the 21st car first, and the head is the same node.
    expect(rowsAfter, 'page 2 must hold 20 rows').toHaveLength(20);
    expect(rowsAfter[0]?.dataset.carNumber, 'page 2 must start at the 21st car').toBe('6');
    expect(
      rowsAfter.some((row) => rowsBefore.has(row)),
      'a page turn draws new rows; none of page 1’s rows stay',
    ).toBe(false);
    expect(findPartOfTower(tower, 'positions-tower-head'), 'the head must stay').toBe(headBefore);
  });

  it('brings page 1 back when paging is switched to firstPageOnly on page 2', async () => {
    // Arrange: a cycling tower (with the theme's hold, so the timer does not turn pages
    // under the test) on air showing page 2.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms' });
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    await tower.turnToTheNextPageNow();

    // Act: the operator holds the top 20.
    await tower.updateAction({ data: { paging: 'firstPageOnly' }, skipAnimation: true });

    // Assert: page 1 is on air again.
    expect(readCarNumbersOnThePage(tower)[0], 'firstPageOnly must bring page 1 back').toBe(31);
  });

  it('turns no page with a field that fits on one page', async () => {
    // Arrange: a tower on air with 12 cars.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, { entries: createFirstCarsOfTheEnduroSample(12) });
    await tower.playAction({ skipAnimation: true });
    const rowsBefore = listRowElements(tower);

    // Act: ask for the next page.
    await tower.turnToTheNextPageNow();

    // Assert: the same 12 rows, untouched.
    expect(listRowElementsInFlow(tower), 'one page has no next page').toEqual(rowsBefore);
  });
});
