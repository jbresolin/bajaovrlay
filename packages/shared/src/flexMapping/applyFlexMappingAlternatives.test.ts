/**
 * Alternatives in a field rule (packages/shared)
 *
 * What this module is for:
 *   The operator chooses which returned field feeds which target, with alternatives when
 *   one is empty (João's ruling for BAJAOVRLAY-53), rather than BajaOvrLay knowing about
 *   "short names". A rule's `firstOf` lists sources in order; the first value that is
 *   present, not null and not empty or blank text wins, and a fixed value may close the
 *   list. A transform on the rule runs on the value read, never on the fixed value.
 *
 * What these tests prove:
 *   - Team name ← short name, else full name, on real teams: 26BR's team 4 has a short
 *     name; team 100's is empty; 26SE's teams have an empty one or null.
 *   - Text that is only spaces, or only an "&nbsp;", counts as empty.
 *   - The race clock's referenceTimeMs ← elapsed_ms, else 0: the doc's race ten minutes in
 *     reads 600 000, the doc's race before its start reads 0, so a race before its start is
 *     a valid session with a stopped clock at 0:00.
 *   - When every alternative is empty and none is a fixed value, the field is left out.
 *   - A transform runs on the alternative read, and not on the fixed value.
 *
 * What these tests deliberately do not cover:
 *   - Lookups as alternatives: applyFlexMappingLookups.test.ts.
 *   - Which alternatives the config accepts: flexMappingConfigAdditions.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: when the doc's race was ten minutes in. */
const pollMomentMs = 1_760_000_600_000;

/** A list of teams read with the short name first, the full name as the alternative. */
function buildTeamNamesMapping() {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'standings',
      requestId: 'equipes',
      entriesPath: 'teams',
      fields: [],
      entryFields: [
        { targetField: 'carNumber', fromPath: 'number' },
        { targetField: 'teamName', firstOf: [{ fromPath: 'short_name' }, { fromPath: 'name' }] },
      ],
    },
  ]);
}

/** The teams of an equipes answer whose numbers are in `carNumbers`, in the answer's order. */
function pickTeams(fileName: string, carNumbers: number[]): unknown[] {
  const teams = readBajaAppFixture(fileName).teams as Array<{ number: number }>;
  return teams.filter((team) => carNumbers.includes(team.number));
}

/** The session of the Baja API's race, its clock read from elapsed_ms, else 0. */
function buildRaceSessionMapping() {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'session',
      requestId: 'corrida',
      fields: [
        { targetField: 'sessionId', fromPath: 'prova_id' },
        { targetField: 'eventName', fromPath: 'event_id' },
        { targetField: 'sessionName', fromPath: 'name' },
        { targetField: 'sessionKind', constantValue: 'enduro' },
        {
          targetField: 'state',
          fromPath: 'clock.state',
          transformId: 'mapValues',
          transformParameters: {
            waiting: 'pre',
            running: 'green',
            red_flag: 'red',
            finished: 'finished',
          },
        },
        { targetField: 'clock.clockMode', constantValue: 'elapsed' },
        {
          targetField: 'clock.referenceTimeMs',
          firstOf: [{ fromPath: 'clock.elapsed_ms' }, { constantValue: 0 }],
        },
        { targetField: 'clock.referenceWallClockMs', fromPath: 'clock.server_time_ms' },
        {
          targetField: 'clock.running',
          fromPath: 'clock.state',
          transformId: 'mapValues',
          transformParameters: { table: { running: true, red_flag: true }, otherwiseValue: false },
        },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
    },
  ]);
}

describe('applyFlexMapping, alternatives (firstOf)', () => {
  const teamNameScenarios: Array<{
    name: string;
    teams: unknown[];
    expectedEntries: Array<{ carNumber: number; teamName: string }>;
  }> = [
    // The common case: 26BR's team 4 has its short name, which wins.
    {
      name: 'takes the short name "Pato" of 26BR team 4',
      teams: pickTeams(bajaAppFixtureFiles.teams26BR, [4]),
      expectedEntries: [{ carNumber: 4, teamName: 'Pato' }],
    },
    // 26BR's team 100 has an empty short name: the full name takes over.
    {
      name: 'falls back to the full name of 26BR team 100, whose short name is ""',
      teams: pickTeams(bajaAppFixtureFiles.teams26BR, [100]),
      expectedEntries: [{ carNumber: 100, teamName: 'EQUIPE TESTE 2' }],
    },
    // 26SE has no short names at all: team 1's is "", team 2's is null.
    {
      name: 'falls back to the full names of 26SE teams 1 ("") and 2 (null)',
      teams: pickTeams(bajaAppFixtureFiles.teams26SE, [1, 2]),
      expectedEntries: [
        { carNumber: 1, teamName: 'Tuffão Baja SAE' },
        { carNumber: 2, teamName: 'Rampage Baja UFJF' },
      ],
    },
    // Text that is only spaces, or only a non-breaking space entity, is empty too.
    {
      name: 'treats a short name of spaces or of "&nbsp;" as empty',
      teams: [
        { number: 13, short_name: '   ', name: 'Bombaja' },
        { number: 4, short_name: '&nbsp;', name: 'Sinuelo' },
      ],
      expectedEntries: [
        { carNumber: 13, teamName: 'Bombaja' },
        { carNumber: 4, teamName: 'Sinuelo' },
      ],
    },
  ];

  it.each(teamNameScenarios)('$name', ({ teams, expectedEntries }) => {
    // Arrange: the team names mapping and an equipes answer holding this row's teams.
    const mappings = buildTeamNamesMapping();

    // Act: map the answer.
    const result = applyFlexMapping(mappings, { equipes: { teams } }, pollMomentMs);

    // Assert: each team named by its first alternative that is not empty.
    expect(result, 'each team must take the first name that is not empty').toEqual({
      ok: true,
      shapes: { standings: { entries: expectedEntries } },
    });
  });

  const raceClockScenarios: Array<{
    name: string;
    fileName: string;
    expectedClock: Record<string, unknown>;
    expectedState: string;
  }> = [
    // Ten minutes in, elapsed_ms is there: the clock runs from 10:00.
    {
      name: 'reads 600 000 ms of the doc race ten minutes in, running',
      fileName: bajaAppFixtureFiles.raceTenMinutesIn00NE,
      expectedClock: {
        clockMode: 'elapsed',
        referenceTimeMs: 600_000,
        referenceWallClockMs: 1_760_000_600_000,
        running: true,
      },
      expectedState: 'green',
    },
    // Before the start elapsed_ms is null: the fixed 0 takes over, the clock stopped.
    {
      name: 'reads 0 ms of the doc race before its start, stopped',
      fileName: bajaAppFixtureFiles.raceBeforeTheStart26BR,
      expectedClock: {
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        referenceWallClockMs: 1_792_890_969_037,
        running: false,
      },
      expectedState: 'pre',
    },
  ];

  it.each(raceClockScenarios)('$name', ({ fileName, expectedClock, expectedState }) => {
    // Arrange: the race session mapping and this row's race answer.
    const mappings = buildRaceSessionMapping();
    const raceAnswer = readBajaAppFixture(fileName);

    // Act: map it, then check the session as the store would.
    const result = applyFlexMapping(mappings, { corrida: raceAnswer }, pollMomentMs);
    const session = result.ok ? result.shapes.session : undefined;
    const validation = validateDataShape('session', session);

    // Assert: a valid session whose clock is read as this row says.
    expect(validation.isValid, 'the session must pass the canonical validation').toBe(true);
    expect(session, 'the clock and state must be read as this row says').toMatchObject({
      state: expectedState,
      clock: expectedClock,
    });
  });

  it('leaves the field out when every alternative is empty and none is a fixed value', () => {
    // Arrange: a team with neither a short name nor a full name.
    const mappings = buildTeamNamesMapping();
    const teams = [{ number: 99, short_name: '', name: null }];

    // Act: map it.
    const result = applyFlexMapping(mappings, { equipes: { teams } }, pollMomentMs);

    // Assert: the team has no name at all, for the validation to name as missing.
    expect(result, 'a field no alternative fills must be left out').toEqual({
      ok: true,
      shapes: { standings: { entries: [{ carNumber: 99 }] } },
    });
  });

  it('runs the transform on the alternative read, and not on the fixed value', () => {
    // Arrange: a lap count sent as text, else a fixed 0; textToInteger on the rule.
    const mappings = FlexMappingConfigSchema.parse([
      {
        shapeKey: 'positions',
        requestId: 'corrida',
        entriesPath: 'carros',
        fields: [],
        entryFields: [
          { targetField: 'carNumber', fromPath: 'numero' },
          {
            targetField: 'laps',
            transformId: 'textToInteger',
            firstOf: [{ fromPath: 'voltas' }, { constantValue: 0 }],
          },
        ],
      },
    ]);
    const response = {
      carros: [
        { numero: 7, voltas: '42' },
        { numero: 13, voltas: null },
      ],
    };

    // Act: map it.
    const result = applyFlexMapping(mappings, { corrida: response }, pollMomentMs);

    // Assert: "42" read through the transform; the fixed 0 taken as it is.
    expect(result, 'the transform must run on the value read only').toEqual({
      ok: true,
      shapes: {
        positions: {
          entries: [
            { carNumber: 7, laps: 42 },
            { carNumber: 13, laps: 0 },
          ],
        },
      },
    });
  });
});
