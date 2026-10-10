/**
 * Checking a graphic's data against its manifest schema (apps/server)
 *
 * What this module is for:
 *   An OGraf manifest may carry `schema`, a JSON Schema of the data the graphic shows.
 *   `findProblemInGraphicData` checks a take's or an update's data against it and
 *   says what is wrong with the first bad field, so the server can refuse the command
 *   with a message naming that field instead of sending the graphic data it cannot show.
 *
 * What these tests prove:
 *   - Complete, valid data has no problem, even though the schema carries OGraf form
 *     hints (`gddType`) that are not JSON Schema keywords.
 *   - A missing required field, a field the graphic does not have and a value the
 *     schema refuses are each reported with the kind of problem and the field's name;
 *     a field inside an object is named with its full path (`leader.teamNumber`).
 *   - A graphic whose manifest has no `schema` accepts any data.
 *   - A `format` keyword in a schema (`date-time`, say) is not enforced: any text is
 *     accepted, the `type` beside it is still checked, and nothing goes to the console.
 *   - A `schema` that is not a usable JSON Schema is reported as such, never thrown.
 *   - The compiled schema kept for a graphic id is not used once that graphic's
 *     manifest carries a different schema.
 *
 * What these tests deliberately do not cover:
 *   - The pt-BR wording of each refusal; the reducer tests (updateInstanceData.test.ts,
 *     takeGraphicData.test.ts) check the full messages.
 *   - How much time keeping the compiled schema saves; only that it never gives a
 *     wrong answer is checked.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { describe, expect, it, vi } from 'vitest';

import { raceClockManifestForTests } from './builtGraphicsFolder.testSupport.js';
import { findProblemInGraphicData } from './graphicDataValidation.js';

/** Builds the race clock graphic as the graphics slice holds it, data schema included. */
function buildRaceClockGraphic(): Graphic {
  return {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** Builds a graphic with the given id whose manifest carries the given data schema. */
function buildGraphicWithDataSchema(
  graphicId: string,
  dataSchema: Record<string, unknown>,
): Graphic {
  return {
    id: graphicId,
    manifest: {
      id: `baja-${graphicId}`,
      name: 'Placar',
      main: `${graphicId}.js`,
      schema: dataSchema,
    },
    defaultLayerId: 'fullscreen',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** Builds complete race clock data: the enduro under green flag, 1:05:00 in, running. */
function buildGreenFlagEnduroData(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.parse('2026-10-09T13:00:00.000Z'),
    running: true,
  };
}

describe('findProblemInGraphicData with data the schema accepts', () => {
  it('finds no problem in complete race clock data', () => {
    // Arrange: the race clock, whose schema has a `gddType` hint on the session name.
    const raceClock = buildRaceClockGraphic();

    // Act: check the six required fields of a running enduro.
    const problem = findProblemInGraphicData(raceClock, buildGreenFlagEnduroData());

    // Assert: nothing is wrong.
    expect(problem, 'complete, valid data must have no problem').toBeUndefined();
  });

  it('finds no problem in any data when the manifest has no schema', () => {
    // Arrange: a team lower third whose manifest declares no data schema at all.
    const teamLowerThird: Graphic = {
      id: 'team-lower-third',
      manifest: { id: 'baja-team-lower-third', name: 'Tarja de equipe', main: 'tarja.js' },
      defaultLayerId: 'lower-third',
      category: 'lower-third',
      thumbnailUrl: null,
      defaultFields: {},
    };

    // Act: check team 42's data against it.
    const problem = findProblemInGraphicData(teamLowerThird, {
      teamNumber: 42,
      teamName: 'Baja UFPR',
    });

    // Assert: with nothing to check against, nothing is wrong.
    expect(problem, 'a graphic without a schema must accept any data').toBeUndefined();
  });
});

const raceClockProblemScenarios: Array<{
  name: string;
  data: Record<string, unknown>;
  expectedProblem: { kind: string; fieldPath: string };
}> = [
  // The operator's client forgot `running`: the clock would not know whether to tick.
  {
    name: 'reports a required field that was not sent',
    data: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 3_900_000,
      referenceWallClockMs: 1_791_550_800_000,
    },
    expectedProblem: { kind: 'missingField', fieldPath: 'running' },
  },
  // A pt-BR field name typed by hand where the schema says `state`.
  {
    name: 'reports a field the graphic does not have',
    data: { ...buildGreenFlagEnduroData(), bandeira: 'green' },
    expectedProblem: { kind: 'unknownField', fieldPath: 'bandeira' },
  },
  // Blue is not one of the six flags the race clock can show.
  {
    name: 'reports a value outside the list the schema allows',
    data: { ...buildGreenFlagEnduroData(), state: 'azul' },
    expectedProblem: { kind: 'invalidValue', fieldPath: 'state' },
  },
  // A number sent as text, as an HTML form field would hand it over.
  {
    name: 'reports a value of the wrong type',
    data: { ...buildGreenFlagEnduroData(), referenceTimeMs: '3900000' },
    expectedProblem: { kind: 'invalidValue', fieldPath: 'referenceTimeMs' },
  },
];

describe('findProblemInGraphicData with data the schema refuses', () => {
  it.each(raceClockProblemScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the race clock with its data schema.
    const raceClock = buildRaceClockGraphic();

    // Act: check the scenario's data.
    const problem = findProblemInGraphicData(raceClock, data);

    // Assert: the kind of problem and the field are the expected ones.
    expect(problem, 'the first bad field must be reported with what is wrong').toEqual(
      expectedProblem,
    );
  });

  it('names a field inside an object with its full path', () => {
    // Arrange: a scoreboard whose data has the leader as an object with a team number.
    const scoreboard = buildGraphicWithDataSchema('scoreboard', {
      type: 'object',
      properties: {
        leader: {
          type: 'object',
          properties: { teamNumber: { type: 'integer' }, teamName: { type: 'string' } },
          required: ['teamNumber'],
        },
      },
    });

    // Act: check a leader whose team number was left out.
    const problem = findProblemInGraphicData(scoreboard, { leader: { teamName: 'Baja UFPR' } });

    // Assert: the path leads to the field inside `leader`.
    expect(problem, 'a nested field must be named with the path that leads to it').toEqual({
      kind: 'missingField',
      fieldPath: 'leader.teamNumber',
    });
  });
});

describe('findProblemInGraphicData with a schema that uses `format`', () => {
  it('accepts any text for a field with a format and writes nothing to the console', () => {
    // Arrange: a session banner whose start time is declared as a `date-time` text, and
    // a watch on the console, where Ajv would print "unknown format ... ignored".
    const sessionBanner = buildGraphicWithDataSchema('session-banner', {
      type: 'object',
      properties: { startsAt: { type: 'string', format: 'date-time' } },
    });
    const consoleWarnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleLines = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleErrors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act: check a start time written the way a person would, not as a date-time, and
    // one that is not even text.
    const problemInLooseText = findProblemInGraphicData(sessionBanner, { startsAt: 'sábado 9h' });
    const problemInNumber = findProblemInGraphicData(sessionBanner, { startsAt: 9 });
    const numberOfConsoleCalls =
      consoleWarnings.mock.calls.length +
      consoleLines.mock.calls.length +
      consoleErrors.mock.calls.length;
    vi.restoreAllMocks();

    // Assert: the format is not enforced, the type still is, and the console stayed quiet.
    expect(
      problemInLooseText,
      'a `format` keyword is not enforced: any text must be accepted',
    ).toBeUndefined();
    expect(problemInNumber, 'the `type` beside the format must still be enforced').toEqual({
      kind: 'invalidValue',
      fieldPath: 'startsAt',
    });
    expect(
      numberOfConsoleCalls,
      'the check must never write to the console; the server logs only structured JSON',
    ).toBe(0);
  });
});

describe('findProblemInGraphicData with a schema that cannot be used', () => {
  it('reports the schema as unusable instead of throwing', () => {
    // Arrange: a scoreboard whose schema says `type: "texto"`, which is not a JSON Schema type.
    const scoreboardWithBrokenSchema = buildGraphicWithDataSchema('scoreboard-quebrado', {
      type: 'object',
      properties: { leaderName: { type: 'texto' } },
    });

    // Act: check any data against it, twice, as two takes in a row would.
    const problemOnFirstTake = findProblemInGraphicData(scoreboardWithBrokenSchema, {
      leaderName: 'Baja UFPR',
    });
    const problemOnSecondTake = findProblemInGraphicData(scoreboardWithBrokenSchema, {
      leaderName: 'Baja UFPR',
    });

    // Assert: both answers say the schema itself is the problem.
    expect(problemOnFirstTake, 'a broken schema must be reported, not thrown').toEqual({
      kind: 'unusableSchema',
    });
    expect(problemOnSecondTake, 'the remembered answer must be the same').toEqual({
      kind: 'unusableSchema',
    });
  });
});

describe('the compiled schema kept per graphic id', () => {
  it('is not used once the same graphic id carries a different schema', () => {
    // Arrange: a lap counter that first accepts only whole laps, then (rebuilt, same id)
    // only a text such as "12/40". The first check makes the validator keep the first schema.
    const lapCounterBeforeRebuild = buildGraphicWithDataSchema('lap-counter', {
      type: 'object',
      properties: { laps: { type: 'integer' } },
    });
    const lapCounterAfterRebuild = buildGraphicWithDataSchema('lap-counter', {
      type: 'object',
      properties: { laps: { type: 'string' } },
    });
    const problemBeforeRebuild = findProblemInGraphicData(lapCounterBeforeRebuild, { laps: 12 });

    // Act: check the same whole number against the rebuilt graphic.
    const problemAfterRebuild = findProblemInGraphicData(lapCounterAfterRebuild, { laps: 12 });

    // Assert: accepted before, refused after; the kept schema did not answer for the new one.
    expect(problemBeforeRebuild, 'a whole number must pass the first schema').toBeUndefined();
    expect(problemAfterRebuild, 'the rebuilt schema, not the kept one, must be used').toEqual({
      kind: 'invalidValue',
      fieldPath: 'laps',
    });
  });
});
