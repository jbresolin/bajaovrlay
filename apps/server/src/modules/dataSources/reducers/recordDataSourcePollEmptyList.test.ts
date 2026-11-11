/**
 * An empty list after real data: recordDataSourcePoll (apps/server)
 *
 * What this module is for:
 *   A timing system that restarts, or a Baja app between two refreshes, can answer a list
 *   with no car in it. That answer is valid JSON and passes the shapes, so before
 *   BAJAOVRLAY-32 it replaced the last good data: a tower on air reading the source went
 *   to zero rows in the middle of a race. Rule 4 says nothing on air is ever blanked by a
 *   failure, so a positions or standings list that goes from cars to none is recorded as a
 *   failed poll: the last good data stays, the source is late, and the reason is named.
 *   The chaos suite's "answers an empty list" scenario found it (apps/control/e2e/chaos).
 *
 * What these tests prove:
 *   - Positions with no entry, after positions with 20 cars, is a failed poll: the stored
 *     snapshot stays as it was, the source is stale and its error says the list came empty.
 *   - The same for standings with no entry after a table of teams.
 *   - The first data a source ever sends may be an empty list (a race before its green
 *     flag): it is stored, since there is nothing on air to blank.
 *   - An empty list after an empty list is stored as usual.
 *   - A list of fewer cars (cars retired) is stored: only "none at all" is a failure.
 *   - After a change of the source's config (the Baja app source pointed at the next
 *     prova) or a restarted simulated race, the next good poll counts as a first poll: an
 *     empty list is stored, since the old race's cars belong to a race that is over (gate 2
 *     of PR #61). Only that one poll: the poll after it applies the rule again. A rename
 *     alone changes no race, and the rule still applies after it.
 *
 * What these tests deliberately do not cover:
 *   - The incidents and Super Chats lists: they are empty most of the race by nature,
 *     and no graphic shows them as a table.
 *   - The rest of a poll's outcome: recordDataSourcePoll.test.ts.
 *   - The tower on air keeping its rows: the chaos suite's emptyListKeepsTheTower.chaos.ts.
 */
import type {
  DataSnapshot,
  DataSnapshotShapes,
  RecordDataSourcePollCommand,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The moment of the poll each test records: the moment of the command. */
const momentOfThePollMs = momentOfTheCommandMs;

const teamsOfTheRace = [
  { carNumber: 42, teamName: 'Carcará Baja', schoolName: 'UFPR' },
  { carNumber: 7, teamName: 'Juriti Off-Road', schoolName: 'UFSC' },
  { carNumber: 19, teamName: 'Mangue Baja', schoolName: 'UFPE' },
];

/** Builds the enduro's positions with these cars in race order, as the simulator says them. */
function buildPositionsOfCars(carCount: number): DataSnapshotShapes['positions'] {
  const entries = teamsOfTheRace.slice(0, carCount).map((team, index) => ({
    position: index + 1,
    ...team,
    laps: 6,
    status: 'running' as const,
  }));
  return { sessionId: 'enduro-2027-nacional', updatedAtMs: momentOfThePollMs, entries };
}

/** Builds the overall standings with these teams, as the Baja app's "Geral" table says them. */
function buildStandingsOfTeams(teamCount: number): DataSnapshotShapes['standings'] {
  const entries = teamsOfTheRace.slice(0, teamCount).map((team, index) => ({
    rank: index + 1,
    ...team,
    points: 900 - index * 50,
  }));
  return { scope: 'overall', updatedAtMs: momentOfThePollMs, entries };
}

/** Builds the simulator's stored snapshot of eight seconds ago, holding these shapes. */
function buildStoredSnapshotOf(shapes: DataSnapshotShapes): DataSnapshot {
  return { sourceId: 'simulador-enduro', receivedAtMs: momentOfThePollMs - 8_000, shapes };
}

/** Builds the poller's good poll that answered these shapes now. */
function buildGoodPollOf(shapes: DataSnapshotShapes): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: { ok: true, shapes, receivedAtMs: momentOfThePollMs },
  };
}

const emptiedListScenarios = [
  // The tower's own case: the race had cars, the timing system answers none.
  {
    name: 'positions with no car, after 3 cars',
    storedShapes: { positions: buildPositionsOfCars(3) },
    polledShapes: { positions: buildPositionsOfCars(0) },
    expectedError: 'A fonte respondeu a lista de posições vazia; os últimos dados foram mantidos.',
  },
  // The standings board reads a table the same way, and blanks the same way.
  {
    name: 'standings with no team, after 3 teams',
    storedShapes: { standings: buildStandingsOfTeams(3) },
    polledShapes: { standings: buildStandingsOfTeams(0) },
    expectedError:
      'A fonte respondeu a lista de classificação vazia; os últimos dados foram mantidos.',
  },
];

describe('recordDataSourcePoll, when a list of cars comes back empty', () => {
  it.each(emptiedListScenarios)(
    'keeps the last good data and marks the source late on $name',
    ({ storedShapes, polledShapes, expectedError }) => {
      // Arrange: a healthy source whose stored data holds a list with cars in it.
      const storedSnapshot = buildStoredSnapshotOf(storedShapes);
      const slicesBefore = buildRaceDaySlicesWithDataSources({
        dataSources: [buildHealthyEnduroSimulator()],
        dataSnapshots: [storedSnapshot],
      });

      // Act: a poll answers the same list with nothing in it.
      const outcome = reduceDataSourceCommand(
        slicesBefore,
        buildGoodPollOf(polledShapes),
        contextOfTheDataSourceCommand,
      );

      // Assert: the stored snapshot is untouched, and the source is late with the reason.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.dataSnapshots, 'the last good data must stay as it was').toEqual([
        storedSnapshot,
      ]);
      expect(slicesAfter?.dataSources[0]?.status.isStale, 'the source must read late').toBe(true);
      expect(
        slicesAfter?.dataSources[0]?.status.lastError,
        'the reason must say the list came empty and the last data was kept',
      ).toBe(expectedError);
    },
  );

  const listsThatAreStored = [
    // Before the green flag a timing system may list nobody yet; nothing is on air to blank.
    {
      name: 'stores an empty list as the first data a source ever sends',
      storedSnapshots: [],
      polledShapes: { positions: buildPositionsOfCars(0) },
    },
    // Still nobody: the empty list is the data, not a change for the worse.
    {
      name: 'stores an empty list after an empty list',
      storedSnapshots: [buildStoredSnapshotOf({ positions: buildPositionsOfCars(0) })],
      polledShapes: { positions: buildPositionsOfCars(0) },
    },
    // Cars leave the list (retired, or the timing system lists only those running): fewer
    // cars is real data, only none at all is suspect.
    {
      name: 'stores a list of one car after a list of 3',
      storedSnapshots: [buildStoredSnapshotOf({ positions: buildPositionsOfCars(3) })],
      polledShapes: { positions: buildPositionsOfCars(1) },
    },
  ];

  it.each(listsThatAreStored)('$name', ({ storedSnapshots, polledShapes }) => {
    // Arrange: a healthy source with this row's stored data, if any.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
      dataSnapshots: storedSnapshots,
    });

    // Act: record this row's poll.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      buildGoodPollOf(polledShapes),
      contextOfTheDataSourceCommand,
    );

    // Assert: the polled shapes are now the stored data, and the source is healthy.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.dataSnapshots.map((snapshot) => snapshot.shapes),
      'the polled list must be stored as the source data',
    ).toEqual([polledShapes]);
    expect(slicesAfter?.dataSources[0]?.status.isStale, 'the source must stay healthy').toBe(false);
  });
});

/**
 * Sends these commands one after the other, as the store applies them, and answers the
 * slices after the last. Fails, naming it, when one is refused.
 */
function applyCommandsInTurn(
  slicesAtTheStart: ReturnType<typeof buildRaceDaySlicesWithDataSources>,
  commands: Parameters<typeof reduceDataSourceCommand>[1][],
): ReturnType<typeof buildRaceDaySlicesWithDataSources> {
  let slices = slicesAtTheStart;
  for (const command of commands) {
    const outcome = reduceDataSourceCommand(slices, command, contextOfTheDataSourceCommand);
    if (outcome.status !== 'applied') {
      throw new Error(`${command.type} was refused`);
    }
    slices = outcome.slices;
  }
  return slices;
}

const emptyPositionsPoll = buildGoodPollOf({ positions: buildPositionsOfCars(0) });

const changesBeforeTheEmptyList = [
  // The ruling's first case: the race source pointed at another prova, whose race lists
  // nobody yet. Any change of the config is a new feed.
  {
    name: 'stores an empty list as the first poll after the config changed',
    commandsBefore: [
      {
        type: 'updateDataSource' as const,
        sourceId: 'simulador-enduro',
        config: { seed: 1405 },
      },
    ],
    isTheEmptyListStored: true,
  },
  // The ruling's second case: "Reiniciar corrida" starts a race with nobody on track.
  {
    name: 'stores an empty list as the first poll after the simulated race restarted',
    commandsBefore: [{ type: 'restartSimulatedRace' as const, sourceId: 'simulador-enduro' }],
    isTheEmptyListStored: true,
  },
  // A new name changes no race: the empty list is still suspect.
  {
    name: 'still keeps the last data on an empty list after a rename alone',
    commandsBefore: [
      {
        type: 'updateDataSource' as const,
        sourceId: 'simulador-enduro',
        label: 'Simulador — Enduro 26BR',
      },
    ],
    isTheEmptyListStored: false,
  },
  // One first poll only: a good poll after the change uses it up, and an empty list after
  // that is suspect again.
  {
    name: 'keeps the last data on an empty list once a good poll followed the change',
    commandsBefore: [
      { type: 'restartSimulatedRace' as const, sourceId: 'simulador-enduro' },
      buildGoodPollOf({ positions: buildPositionsOfCars(2) }),
    ],
    isTheEmptyListStored: false,
  },
];

describe('recordDataSourcePoll, when the feed changed before the empty list', () => {
  it.each(changesBeforeTheEmptyList)('$name', ({ commandsBefore, isTheEmptyListStored }) => {
    // Arrange: a healthy source holding 3 cars, then this row's commands.
    const slicesBefore = applyCommandsInTurn(
      buildRaceDaySlicesWithDataSources({
        dataSources: [buildHealthyEnduroSimulator()],
        dataSnapshots: [buildStoredSnapshotOf({ positions: buildPositionsOfCars(3) })],
      }),
      commandsBefore,
    );

    // Act: a poll answers the positions with no car.
    const slicesAfter = applyCommandsInTurn(slicesBefore, [emptyPositionsPoll]);

    // Assert: the empty list is the data, or the last data stayed, as the row expects;
    // and either way no first poll is left waiting.
    const storedEntryCount = slicesAfter.dataSnapshots[0]?.shapes.positions?.entries.length;
    expect(
      storedEntryCount === 0,
      isTheEmptyListStored
        ? 'after a change of feed, the empty list must be stored as the new race'
        : 'without a change of feed, the last good cars must stay',
    ).toBe(isTheEmptyListStored);
    expect(
      slicesAfter.dataSources[0]?.status.isNextPollAFirstPoll,
      'a poll after the change must use up the first poll',
    ).toBeUndefined();
  });
});
