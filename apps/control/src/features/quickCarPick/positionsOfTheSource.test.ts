/**
 * The positions "Escolher carros" reads (apps/control)
 *
 * What this module is for:
 *   "Escolher carros" (BAJAOVRLAY-82) suggests cars and names the pair typed from the
 *   source's positions, read through the shared resolver a take uses, so a correction
 *   of a team's name shows here as it will on air. It also says which source a pick is
 *   made on when the item reads none yet.
 *
 * What these tests prove:
 *   - The simulator's 60 cars are read in their order, with an operator's correction of
 *     car 38's team name laid over them.
 *   - A source that has sent nothing yet has no positions.
 *   - The item's own source is kept; with none, the only source sending positions is
 *     chosen; with two such sources and none on the item, none is chosen.
 *   - A car is found by its number, and by its place counted from 1.
 *
 * What these tests deliberately do not cover:
 *   - How the resolver reads a snapshot (packages/shared bindingResolution tests).
 */
import { describe, expect, it } from 'vitest';

import {
  buildCorrectionOfTheSecondCarsTeam,
  buildSlicesWithTheBattleCardOfTheLeaders,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildRehearsalReplayThatIsOk,
  rehearsalReplayId,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  chooseSourceForQuickCarPick,
  findCarAtPlace,
  findCarByNumber,
  readPositionsOfSourceNow,
} from './positionsOfTheSource';

describe('readPositionsOfSourceNow', () => {
  it('reads the simulator’s cars in order, with the correction of car 38’s team laid over them', () => {
    // Arrange: the simulator at lap 34, and the operator's correction of car 38's team.
    const slices = {
      ...buildSlicesWithTheBattleCardOfTheLeaders(),
      overrides: [buildCorrectionOfTheSecondCarsTeam()],
    };

    // Act: read the simulator's positions now.
    const positions = readPositionsOfSourceNow(seededSimulatorId, slices);

    // Assert: 60 cars, the leader first, and car 38 named as the correction says.
    expect(positions?.length, 'the simulator lists 60 cars').toBe(60);
    expect(positions?.[0]?.carNumber, 'car 31 leads at lap 34').toBe(31);
    expect(positions?.[1]?.teamName, 'a correction must show here as it will on air').toBe(
      'Coruja Racing EESC',
    );
  });

  it('reads no positions from a source that has sent nothing yet', () => {
    // Arrange: the simulator listed, but no data from it.
    const slices = { ...buildSlicesWithTheBattleCardOfTheLeaders(), dataSnapshots: [] };

    // Act: read its positions.
    const positions = readPositionsOfSourceNow(seededSimulatorId, slices);

    // Assert: none, which the console says rather than suggesting nothing silently.
    expect(positions, 'no data means no positions').toBeUndefined();
  });
});

describe('chooseSourceForQuickCarPick', () => {
  it('keeps the source the item’s cars already read', () => {
    // Arrange: two sources with positions; the item reads the rehearsal replay.
    const slices = buildSlicesWithTwoSourcesSendingPositions();

    // Act: choose the source of a new pick for an item on the replay.
    const sourceId = chooseSourceForQuickCarPick(rehearsalReplayId, slices);

    // Assert: the replay, as stored.
    expect(sourceId, 'a pick must never move the item to another source').toBe(rehearsalReplayId);
  });

  it('chooses the only source sending positions when the item reads none', () => {
    // Arrange: the simulator alone, sending positions; an item typed by hand.
    const slices = buildSlicesWithTheBattleCardOfTheLeaders();

    // Act: choose the source of a new pick for an item with no source.
    const sourceId = chooseSourceForQuickCarPick(undefined, slices);

    // Assert: the simulator.
    expect(sourceId, 'the only source with positions must be chosen').toBe(seededSimulatorId);
  });

  it('chooses none when two sources send positions and the item reads neither', () => {
    // Arrange: the simulator and the replay, both sending positions.
    const slices = buildSlicesWithTwoSourcesSendingPositions();

    // Act: choose the source of a new pick for an item with no source.
    const sourceId = chooseSourceForQuickCarPick(undefined, slices);

    // Assert: none; the operator chooses in the item editor.
    expect(sourceId, 'a guess between two sources would be wrong half the time').toBeUndefined();
  });
});

describe('findCarByNumber and findCarAtPlace', () => {
  it('finds car 47 by its number, and the car running 3rd by its place', () => {
    // Arrange: the simulator's positions at lap 34.
    const positions = readPositionsOfSourceNow(
      seededSimulatorId,
      buildSlicesWithTheBattleCardOfTheLeaders(),
    );

    // Act: look up car 47, and the 3rd place.
    const car47 = findCarByNumber(positions ?? [], 47);
    const carRunningThird = findCarAtPlace(positions ?? [], 3);

    // Assert: Carnaúba Baja runs 6th; Bem-te-vi Off-Road, car 25, runs 3rd.
    expect(car47?.teamName, 'car 47 is Carnaúba Baja').toBe('Carnaúba Baja');
    expect(carRunningThird?.carNumber, 'car 25 runs 3rd at lap 34').toBe(25);
  });
});

/** The battle card's slices with the rehearsal replay also sending the lap-34 data. */
function buildSlicesWithTwoSourcesSendingPositions() {
  const slices = buildSlicesWithTheBattleCardOfTheLeaders();
  return {
    ...slices,
    dataSources: [...slices.dataSources, buildRehearsalReplayThatIsOk()],
    dataSnapshots: [...slices.dataSnapshots, buildEnduroSnapshotAtLap34(rehearsalReplayId)],
  };
}
