/**
 * Row diff between two positions snapshots (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   Every update brings a new list, and the tower must move pills rather than rebuild
 *   them: a car that stays on the page keeps its row node and slides to its new slot, a
 *   car that arrives on the page gets a new row, a car that leaves has its row lifted out.
 *   This module compares the cars visible before and after an update, keyed by car number,
 *   and says which rows stay (and whether their slot moved up or down), which enter, which
 *   leave, and whether slot 1 has a new car.
 *
 * What these tests prove:
 *   - Two cars trading places: both stay, one moved up and the other down, every other
 *     car stays in its slot, nobody enters or leaves, the leader is the same.
 *   - A car gaining three places: it moved up, the three it passed moved down.
 *   - A new leader: the car now in slot 1 is reported, even though nobody entered or left.
 *   - A car crossing the page boundary: the car arriving from the next page enters, the
 *     car pushed off the page leaves, and the rows between them moved down.
 *   - A page turn: everything leaves and everything enters, nothing stays.
 *
 * What these tests deliberately do not cover:
 *   - The motion itself (FLIP, rise, lift); positionsTowerAnimations.ts and the Playwright
 *     tests cover it. This module only says what moved.
 */
import { describe, expect, it } from 'vitest';

import { diffVisibleRows } from './towerRowDiff.js';

/** The page-1 cars of the enduro sample, by car number, in order. */
const pageOneCarNumbers = [
  31, 38, 25, 78, 52, 47, 30, 81, 49, 95, 67, 93, 89, 45, 98, 32, 69, 64, 42, 71,
];

/** Builds entries (position and car number) from car numbers in order. */
function createEntriesInOrder(carNumbers: number[]) {
  return carNumbers.map((carNumber, index) => ({ position: index + 1, carNumber }));
}

/** Swaps the cars at two indexes of a list of car numbers (a new list). */
function swapCarsAt(carNumbers: number[], indexA: number, indexB: number): number[] {
  const swapped = [...carNumbers];
  const carA = swapped[indexA];
  const carB = swapped[indexB];
  if (carA === undefined || carB === undefined) {
    throw new Error('swapCarsAt was given an index outside the list');
  }
  swapped[indexA] = carB;
  swapped[indexB] = carA;
  return swapped;
}

describe('diffVisibleRows', () => {
  it('reports two cars trading places as one up, one down, and everybody else staying put', () => {
    // Arrange: page 1 before, then cars 25 (3rd) and 78 (4th) trade places.
    const before = createEntriesInOrder(pageOneCarNumbers);
    const after = createEntriesInOrder(swapCarsAt(pageOneCarNumbers, 2, 3));

    // Act: compare the two.
    const diff = diffVisibleRows(before, after);

    // Assert: 78 moved up to slot 3, 25 moved down to slot 4, the rest stayed in place,
    // nobody entered or left and the leader is unchanged.
    const movedRows = diff.staying.filter((row) => row.direction !== 'same');
    expect(movedRows, 'only the two cars that traded places moved').toEqual([
      { carNumber: 78, slotBefore: 4, slotAfter: 3, direction: 'up' },
      { carNumber: 25, slotBefore: 3, slotAfter: 4, direction: 'down' },
    ]);
    expect(diff.staying, 'every car of the page stays on the page').toHaveLength(20);
    expect(diff.entering, 'nobody enters on a swap').toEqual([]);
    expect(diff.leaving, 'nobody leaves on a swap').toEqual([]);
    expect(diff.newLeaderCarNumber, 'the leader is the same car').toBeUndefined();
  });

  it('reports a car gaining three places as up, and the three it passed as down', () => {
    // Arrange: car 95 (10th) jumps to 7th; cars 30, 81 and 49 each drop one slot.
    const before = createEntriesInOrder(pageOneCarNumbers);
    const afterCarNumbers = [
      31, 38, 25, 78, 52, 47, 95, 30, 81, 49, 67, 93, 89, 45, 98, 32, 69, 64, 42, 71,
    ];
    const after = createEntriesInOrder(afterCarNumbers);

    // Act: compare the two.
    const diff = diffVisibleRows(before, after);

    // Assert: one up, three down, in the order of the new page.
    const movedRows = diff.staying.filter((row) => row.direction !== 'same');
    expect(movedRows, 'the climber goes up and the three passed go down').toEqual([
      { carNumber: 95, slotBefore: 10, slotAfter: 7, direction: 'up' },
      { carNumber: 30, slotBefore: 7, slotAfter: 8, direction: 'down' },
      { carNumber: 81, slotBefore: 8, slotAfter: 9, direction: 'down' },
      { carNumber: 49, slotBefore: 9, slotAfter: 10, direction: 'down' },
    ]);
  });

  it('reports the new leader when slot 1 changes hands', () => {
    // Arrange: car 38 overtakes car 31 for the lead.
    const before = createEntriesInOrder(pageOneCarNumbers);
    const after = createEntriesInOrder(swapCarsAt(pageOneCarNumbers, 0, 1));

    // Act: compare the two.
    const diff = diffVisibleRows(before, after);

    // Assert: car 38 is named as the new leader.
    expect(diff.newLeaderCarNumber, 'car 38 must be reported as the new leader').toBe(38);
  });

  it('reports a car arriving from the next page as entering and the car pushed off as leaving', () => {
    // Arrange: car 6 (21st, on page 2) climbs to 20th; car 71 drops to 21st, off page 1.
    const before = createEntriesInOrder(pageOneCarNumbers);
    const afterCarNumbers = [...pageOneCarNumbers.slice(0, 19), 6];
    const after = createEntriesInOrder(afterCarNumbers);

    // Act: compare the two.
    const diff = diffVisibleRows(before, after);

    // Assert: 6 enters, 71 leaves, and the 19 others stay in their slots.
    expect(diff.entering, 'car 6 must enter the page').toEqual([6]);
    expect(diff.leaving, 'car 71 must leave the page').toEqual([71]);
    expect(diff.staying, 'the other 19 cars stay').toHaveLength(19);
    expect(
      diff.staying.every((row) => row.direction === 'same'),
      'nobody else changed slot',
    ).toBe(true);
  });

  it('reports a page turn as everybody leaving and everybody entering', () => {
    // Arrange: page 1 before, page 2 (twenty other cars) after.
    const before = createEntriesInOrder(pageOneCarNumbers);
    const pageTwoCarNumbers = pageOneCarNumbers.map((carNumber) => carNumber + 100);
    const after = createEntriesInOrder(pageTwoCarNumbers);

    // Act: compare the two.
    const diff = diffVisibleRows(before, after);

    // Assert: nothing stays; the old page leaves and the new page enters.
    expect(diff.staying, 'no car is on both pages').toEqual([]);
    expect(diff.leaving, 'every car of page 1 leaves').toEqual(pageOneCarNumbers);
    expect(diff.entering, 'every car of page 2 enters').toEqual(pageTwoCarNumbers);
  });
});
