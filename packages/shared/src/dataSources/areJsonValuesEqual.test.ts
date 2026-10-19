/**
 * Comparing two JSON values by content (packages/shared)
 *
 * What this module is for:
 *   A poll that repeats the stored shapes, or an edit that saves what is there, must hand
 *   back the same slices so the store saves, logs and broadcasts nothing. That needs a
 *   comparison by content that does not care in which order an object's keys were
 *   written: a config built in memory and the same config read back from the database
 *   can list their keys differently.
 *
 * What these tests prove:
 *   - Equal content is equal whatever the key order, at any depth.
 *   - A changed number, a missing key, a longer list or a different order of a list
 *     makes the values different; a key holding undefined counts as absent.
 *
 * What these tests deliberately do not cover:
 *   - Values that are not JSON (dates, maps, functions): shapes and configs never hold them.
 */
import { describe, expect, it } from 'vitest';

import { areJsonValuesEqual } from './areJsonValuesEqual.js';

const comparisonScenarios = [
  // The reason this helper exists: the same config, keys written in another order.
  {
    name: 'finds two configs equal whatever the order of their keys',
    first: { seed: 2027, carCount: 60, simulatedStartAtMs: 1_786_716_000_000 },
    second: { simulatedStartAtMs: 1_786_716_000_000, seed: 2027, carCount: 60 },
    expectedIsEqual: true,
  },
  // Deep down, as in a positions shape: car 42 on lap 34 in both.
  {
    name: 'finds two lists of cars equal when every car is',
    first: {
      entries: [
        { carNumber: 42, laps: 34 },
        { carNumber: 7, laps: 34 },
      ],
    },
    second: {
      entries: [
        { laps: 34, carNumber: 42 },
        { laps: 34, carNumber: 7 },
      ],
    },
    expectedIsEqual: true,
  },
  // Car 42 completed one more lap: a real change.
  {
    name: 'tells a changed lap count apart',
    first: { entries: [{ carNumber: 42, laps: 34 }] },
    second: { entries: [{ carNumber: 42, laps: 35 }] },
    expectedIsEqual: false,
  },
  // Two cars swapped places: the order of a list is its meaning.
  {
    name: 'tells a different order of the list apart',
    first: [{ carNumber: 42 }, { carNumber: 7 }],
    second: [{ carNumber: 7 }, { carNumber: 42 }],
    expectedIsEqual: false,
  },
  // A car joined the list.
  {
    name: 'tells a longer list apart',
    first: [{ carNumber: 42 }],
    second: [{ carNumber: 42 }, { carNumber: 7 }],
    expectedIsEqual: false,
  },
  // The gap became known: a key that appeared.
  {
    name: 'tells a missing key apart',
    first: { carNumber: 7, gapToLeaderMs: 4_200 },
    second: { carNumber: 7 },
    expectedIsEqual: false,
  },
  // Saved as JSON, an undefined key disappears; it must compare like that too.
  {
    name: 'treats a key holding undefined as absent',
    first: { carNumber: 7, gapToLeaderMs: undefined },
    second: { carNumber: 7 },
    expectedIsEqual: true,
  },
  // null is a value ("no error"), not an object.
  {
    name: 'tells null apart from an empty object',
    first: { lastError: null },
    second: { lastError: {} },
    expectedIsEqual: false,
  },
];

describe('areJsonValuesEqual', () => {
  it.each(comparisonScenarios)('$name', ({ first, second, expectedIsEqual }) => {
    // Arrange: the two values of this row (built above).

    // Act: compare them.
    const isEqual = areJsonValuesEqual(first, second);

    // Assert: equal or not, as the row says.
    expect(isEqual, 'content decides, not key order').toBe(expectedIsEqual);
  });
});
