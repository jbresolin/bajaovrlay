/**
 * What the positions shape accepts from a real source (packages/shared)
 *
 * What this module is for:
 *   A timing system does not always know every gap, and lists cars out of the race
 *   (retired, disqualified, not started) where it likes. João's ruling at gate 2 of
 *   PR #16 is that the positions shape accepts what a source gives, as long as nothing in
 *   it is wrong, so a real source's data reaches the tower instead of failing the poll.
 *
 * What these tests prove:
 *   - Accepted: a car with no gap (on the leader's lap or lapped); a gap in ms and an
 *     interval before the leader's first lap; a retired car with more laps below running
 *     cars, even more than the leader; a disqualified car on the leader's laps at the
 *     bottom; a car that did not start listed above a running car; a retired car at
 *     position 1, which is still the leader the gaps are measured from.
 *
 * What these tests deliberately do not cover:
 *   - What the shape refuses, and the pt-BR sentence it says it with; that is
 *     positionsShape.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildPositionsAtTheStart,
  lastPlaceIndex,
  readPositionsSample,
  withoutAnyGap,
} from './positionsShape.testSupport.js';
import { validateDataShape } from './validateDataShape.js';

describe('positions a real source may send', () => {
  const acceptedPositionsScenarios: Array<{ name: string; buildPayload: () => unknown }> = [
    // The start of the race: nobody has a lap and nobody has a gap.
    {
      name: 'accepts the start of the race, when nobody has a lap and nobody has a gap',
      buildPayload: () => buildPositionsAtTheStart(),
    },
    // Gate 2 (João): a gap is optional; a timing system that does not send one for a car
    // still sends that car's place, which is worth showing.
    {
      name: 'accepts a car behind the leader with no gap',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[1] = withoutAnyGap(positions.entries[1]);
        return positions;
      },
    },
    // Gate 2 (João): the same for a lapped car.
    {
      name: 'accepts a lapped car with no gap',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = withoutAnyGap(positions.entries[2]);
        return positions;
      },
    },
    // Gate 2 (João): before the first lap a car is on the leader's lap, so a gap in ms
    // is the right kind; a source timing from the start line may know it.
    {
      name: "accepts a gap in ms before the leader's first lap",
      buildPayload: () => {
        const positions = buildPositionsAtTheStart();
        positions.entries[1] = { ...positions.entries[1], gapToLeaderMs: 800 };
        return positions;
      },
    },
    // Gate 2: for the same reason an interval before the first lap is the source's to give.
    {
      name: 'accepts an interval on a car that has not completed a lap',
      buildPayload: () => {
        const positions = buildPositionsAtTheStart();
        positions.entries[1] = { ...positions.entries[1], intervalMs: 800 };
        return positions;
      },
    },
    // Gate 2 (João): a retired car is often listed below the running ones whatever its
    // laps; car 96 retired with 30 laps sits below cars on 24.
    {
      name: 'accepts a retired car with more laps below running cars',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[lastPlaceIndex] = {
          ...positions.entries[lastPlaceIndex],
          laps: 30,
          gapToLeaderLaps: 4,
        };
        return positions;
      },
    },
    // Gate 2 (João): a disqualified car keeps the laps it ran, here the leader's 34, at
    // the bottom of the list; on the leader's lap its gap, if any, is in ms.
    {
      name: "accepts a disqualified car on the leader's laps at the bottom of the list",
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[lastPlaceIndex] = {
          ...withoutAnyGap(positions.entries[lastPlaceIndex]),
          laps: 34,
          gapToLeaderMs: 95_000,
          status: 'disqualified',
        };
        return positions;
      },
    },
    // Gate 2 (João): a car that never started may be listed among the running cars, and
    // the running car behind it is compared with the nearest running car ahead instead.
    {
      name: 'accepts a car that did not start listed above a running car',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[58] = {
          position: 59,
          carNumber: 1,
          teamName: 'Cascavel Off-Road',
          schoolName: 'UNIOESTE',
          laps: 0,
          status: 'notStarted',
        };
        positions.entries[lastPlaceIndex] = {
          ...positions.entries[lastPlaceIndex],
          status: 'running',
        };
        return positions;
      },
    },
    // Gate 2: a car out of the race may have more laps than the leader; it then has no gap.
    {
      name: 'accepts a retired car with more laps than the leader and no gap',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[lastPlaceIndex] = {
          ...withoutAnyGap(positions.entries[lastPlaceIndex]),
          laps: 36,
        };
        return positions;
      },
    },
    // Gate 2: a retired car with the most laps may be listed first, as our simulator lists
    // it; it is still the leader, and the gaps below it are measured from it.
    {
      name: 'accepts a retired car at position 1, with the gaps below it measured from it',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[0] = { ...positions.entries[0], status: 'retired' };
        return positions;
      },
    },
  ];

  it.each(acceptedPositionsScenarios)('$name', ({ buildPayload }) => {
    // Arrange: a payload a real source may send, as this row describes.
    const payloadFromTheSource = buildPayload();

    // Act: validate it as positions.
    const validation = validateDataShape('positions', payloadFromTheSource);

    // Assert: accepted; on failure the message shows which rule still refuses it.
    expect(
      validation.isValid ? 'accepted' : validation.errorMessage,
      'the shape must accept what this row describes',
    ).toBe('accepted');
  });
});
