/**
 * Canonical data shapes and their validation (packages/shared)
 *
 * What this module is for:
 *   Every data source (the simulator, a replay, later the Baja app) produces the same
 *   four shapes: session, positions, standings and brackets. Graphics bind only to these.
 *   `validateDataShape` checks a payload for one shape and, when it is wrong, returns one
 *   pt-BR sentence naming the path of the first bad field, which the operator reads on
 *   the "Fontes de dados" page.
 *
 * What these tests prove:
 *   - Each of the six sample payloads in samples/ passes its shape, so the samples can
 *     be trusted as fixtures and as documentation.
 *   - Session, standings and brackets payloads with one mistake are refused, each with
 *     the exact pt-BR sentence the operator reads, naming the path from the shape's key.
 *     Asserting the whole sentence proves which rule fired, not only where. The rules:
 *     a flag and a clock mode the race clock knows; a standings scope that exists and is
 *     present; standings that start at rank 1, come in rank order and list a team once;
 *     a match of two different cars whose winner is one of them.
 *
 * What these tests deliberately do not cover:
 *   - The positions rules (gaps, intervals, order); that is positionsShape.test.ts.
 *   - That the session flag and clock match the race clock graphic; that is
 *     sessionShapeMatchesRaceClock.test.ts.
 *   - The list of paths a binding may point at; that is bindablePaths.test.ts.
 *   - What a data source does with an invalid payload (a failed poll); the server's
 *     dataSources module covers that.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { DataShapeKey } from './dataShapeKey.js';
import { validateDataShape } from './validateDataShape.js';

/**
 * Reads one sample payload from samples/ as plain JSON, exactly as a source would send it.
 * Read afresh on every call, so each test can break one thing in its own copy.
 */
function readSamplePayload(fileName: string): unknown {
  const sampleUrl = new URL(`./samples/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8')) as unknown;
}

/** The positions or standings sample as plain JSON: entries that can be read one by one. */
type SamplePayloadWithEntries = { entries: Array<Record<string, unknown>> } & Record<
  string,
  unknown
>;

/** The brackets sample as plain JSON: rounds whose matches can be changed one by one. */
type BracketsSamplePayload = {
  rounds: Array<{ matches: Array<Record<string, unknown>> }>;
} & Record<string, unknown>;

describe('the sample payloads', () => {
  const sampleScenarios: Array<{ name: string; shapeKey: DataShapeKey; fileName: string }> = [
    // The session while the enduro runs under green.
    {
      name: 'the green-flag enduro session passes the session shape',
      shapeKey: 'session',
      fileName: 'session.enduro-green.json',
    },
    // The same session during a yellow, so a flag change has a fixture.
    {
      name: 'the yellow-flag enduro session passes the session shape',
      shapeKey: 'session',
      fileName: 'session.enduro-yellow.json',
    },
    // 60 cars at lap 34: pit stops, a retirement, gaps in ms and in laps.
    {
      name: 'the 60-car positions at lap 34 pass the positions shape',
      shapeKey: 'positions',
      fileName: 'positions.enduro-lap-34.json',
    },
    // The overall standings with their score parts, a part one team lacks, and a
    // disqualified team at the end.
    {
      name: 'the overall standings pass the standings shape',
      shapeKey: 'standings',
      fileName: 'standings.overall.json',
    },
    // The draft brackets, with a final not decided yet.
    {
      name: 'the suspension brackets pass the brackets shape',
      shapeKey: 'brackets',
      fileName: 'brackets.suspension.json',
    },
    // The incidents of the enduro: a penalty, a warning, an incident with no moment.
    {
      name: 'the enduro incidents pass the incidents shape',
      shapeKey: 'incidents',
      fileName: 'incidents.enduro.json',
    },
  ];

  it.each(sampleScenarios)('$name', ({ shapeKey, fileName }) => {
    // Arrange: the sample file of this row, read as raw JSON.
    const samplePayload = readSamplePayload(fileName);

    // Act: validate it for its shape.
    const validation = validateDataShape(shapeKey, samplePayload);

    // Assert: it is valid, and nothing in it was lost on the way.
    expect(validation, `${fileName} must be valid`).toEqual({
      isValid: true,
      shape: samplePayload,
    });
  });

  it('the positions sample reads like a real enduro: 60 cars, pit stops, a retirement and both kinds of gap', () => {
    // Arrange: the positions sample.
    const positions = readSamplePayload('positions.enduro-lap-34.json') as SamplePayloadWithEntries;

    // Act: count what a reviewer would look for in it.
    const statuses = positions.entries.map((entry) => entry.status);
    const carsWithGapInMs = positions.entries.filter((entry) => 'gapToLeaderMs' in entry);
    const carsWithGapInLaps = positions.entries.filter((entry) => 'gapToLeaderLaps' in entry);
    const bestLapTimesMs = positions.entries
      .map((entry) => entry.bestLapMs)
      .filter((bestLapMs): bestLapMs is number => typeof bestLapMs === 'number');

    // Assert: the fixture has every case the graphics will meet.
    expect(positions.entries, 'the sample must carry 60 cars').toHaveLength(60);
    expect(statuses, 'some cars must be in the pit').toContain('inPit');
    expect(
      statuses.filter((status) => status === 'retired'),
      'exactly one car must be retired',
    ).toHaveLength(1);
    expect(positions.entries[0]?.laps, 'the leader must be on lap 34').toBe(34);
    expect(carsWithGapInMs.length, 'some cars must be on the leader lap').toBeGreaterThan(0);
    expect(carsWithGapInLaps.length, 'some cars must be laps down').toBeGreaterThan(0);
    // (Best laps, not last laps: a lap with a pit stop in it rightly runs over 7 minutes.)
    expect(
      bestLapTimesMs.every((lapMs) => lapMs >= 240_000 && lapMs <= 420_000),
      'the best enduro lap of every car must take between 4 and 7 minutes',
    ).toBe(true);
  });
});

describe('session, standings and brackets a source must never send', () => {
  const refusedPayloadScenarios: Array<{
    name: string;
    shapeKey: DataShapeKey;
    buildPayload: () => unknown;
    expectedErrorMessage: string;
  }> = [
    // The flag feeds the race clock with no transform, so it must be one the clock knows.
    {
      name: 'refuses a session flag the race clock does not know',
      shapeKey: 'session',
      buildPayload: () => ({
        ...(readSamplePayload('session.enduro-green.json') as Record<string, unknown>),
        state: 'safetyCar',
      }),
      expectedErrorMessage: 'Dados inválidos em "session.state": valor fora da lista permitida.',
    },
    // The clock counts up or down only; anything else would freeze the graphic.
    {
      name: 'refuses a session clock in an unknown mode',
      shapeKey: 'session',
      buildPayload: () => {
        const session = readSamplePayload('session.enduro-green.json') as {
          clock: Record<string, unknown>;
        };
        return { ...session, clock: { ...session.clock, clockMode: 'countdown' } };
      },
      expectedErrorMessage:
        'Dados inválidos em "session.clock.clockMode": valor fora da lista permitida.',
    },
    // A standings scope is "overall" or one event; anything else has no meaning.
    {
      name: 'refuses standings for an unknown scope',
      shapeKey: 'standings',
      buildPayload: () => ({
        ...(readSamplePayload('standings.overall.json') as Record<string, unknown>),
        scope: 'campeonato',
      }),
      expectedErrorMessage: 'Dados inválidos em "standings.scope": valor fora da lista permitida.',
    },
    // A missing scope must read as missing, not as a value outside the list.
    {
      name: 'refuses standings with no scope, saying the field is missing',
      shapeKey: 'standings',
      buildPayload: () => {
        const standings = readSamplePayload('standings.overall.json') as SamplePayloadWithEntries;
        delete standings.scope;
        return standings;
      },
      expectedErrorMessage:
        'Dados inválidos em "standings.scope": campo ausente ou de tipo errado.',
    },
    // Standings come ordered by rank, so a graphic can show them as they come.
    {
      name: 'refuses standings out of rank order',
      shapeKey: 'standings',
      buildPayload: () => {
        const standings = readSamplePayload('standings.overall.json') as SamplePayloadWithEntries;
        standings.entries[3] = { ...standings.entries[3], rank: 1 };
        return standings;
      },
      expectedErrorMessage:
        'Dados inválidos em "standings.entries.3.rank": a pontuação deve vir em ordem de classificação; o colocado acima tem a posição 3.',
    },
    // A list that starts at 7th would show a 7th place as the top of the graphic.
    {
      name: 'refuses standings whose first team is not ranked 1',
      shapeKey: 'standings',
      buildPayload: () => {
        const standings = readSamplePayload('standings.overall.json') as SamplePayloadWithEntries;
        standings.entries[0] = { ...standings.entries[0], rank: 7 };
        return standings;
      },
      expectedErrorMessage:
        'Dados inválidos em "standings.entries.0.rank": a pontuação começa pela posição 1.',
    },
    // A team listed twice would show twice on a standings graphic (car 45 leads the sample).
    {
      name: 'refuses the same car twice in the standings',
      shapeKey: 'standings',
      buildPayload: () => {
        const standings = readSamplePayload('standings.overall.json') as SamplePayloadWithEntries;
        standings.entries[1] = {
          ...standings.entries[1],
          carNumber: standings.entries[0]?.carNumber,
        };
        return standings;
      },
      expectedErrorMessage:
        'Dados inválidos em "standings.entries.1.carNumber": o carro 45 aparece mais de uma vez.',
    },
    // A winner who did not race in the match is a typing mistake in the source.
    {
      name: 'refuses a bracket winner who is neither car of the match',
      shapeKey: 'brackets',
      buildPayload: () => {
        const brackets = readSamplePayload('brackets.suspension.json') as BracketsSamplePayload;
        const quarterFinalMatches = brackets.rounds[0]?.matches ?? [];
        quarterFinalMatches[0] = { ...quarterFinalMatches[0], winnerCarNumber: 999 };
        return brackets;
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": o vencedor 999 não é nenhum dos dois carros da disputa.',
    },
    // The same car on both sides is a typo the winner check alone would let through.
    {
      name: 'refuses a bracket match of a car against itself',
      shapeKey: 'brackets',
      buildPayload: () => {
        const brackets = readSamplePayload('brackets.suspension.json') as BracketsSamplePayload;
        const quarterFinalMatches = brackets.rounds[0]?.matches ?? [];
        const firstMatch = quarterFinalMatches[0] as { carA: { carNumber: number } };
        quarterFinalMatches[0] = {
          ...firstMatch,
          carB: { ...firstMatch.carA },
          winnerCarNumber: firstMatch.carA.carNumber,
        };
        return brackets;
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carB.carNumber": o carro 98 não pode disputar contra si mesmo.',
    },
  ];

  it.each(refusedPayloadScenarios)('$name', ({ shapeKey, buildPayload, expectedErrorMessage }) => {
    // Arrange: a payload with the one mistake of this row.
    const brokenPayload = buildPayload();

    // Act: validate it for its shape.
    const validation = validateDataShape(shapeKey, brokenPayload);

    // Assert: refused, with the pt-BR sentence of this row's rule at the bad path.
    expect(validation, 'the payload must be refused for the rule this row breaks').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});
