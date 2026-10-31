/**
 * The Baja app's results API, mapped end to end into the canonical shapes (packages/shared)
 *
 * What this module is for:
 *   BAJAOVRLAY-53 makes the flex mapping able to read the Baja app's public results API
 *   with no Baja-specific code. This is the proof: each fixture of examples/bajaApp/ (real
 *   answers saved with curl, the doc's examples, one made-up bracket) is mapped with a
 *   draft preset (bajaAppDraftPresets.testSupport.ts; the presets themselves are
 *   BAJAOVRLAY-54's) and every shape it gives passes validateDataShape, as the store
 *   checks a poll.
 *
 * What these tests prove:
 *   - The doc's race ten minutes in gives a running session and positions with gaps worked
 *     out from laps: car 22 one lap down, car 33 (no lap yet, `position` null) three.
 *   - The doc's race before its start gives a valid session with a stopped clock at 0:00
 *     and an empty positions list.
 *   - The real 26BR overall table, joined with the real 26BR teams, gives 51 teams with
 *     short names, the parts of the score, and cars 46 and 54 disqualified and unranked at
 *     the end, though the API gives them "position 50".
 *   - The doc's 25SU table during spoilers is refused with the spoilers sentence.
 *   - The real 25SU and 26BR brackets and the made-up pending one pass (their rounds are
 *     checked in applyFlexMappingBracketContracts.test.ts).
 *
 * What these tests deliberately do not cover:
 *   - Each addition on its own: the applyFlexMapping*.test.ts files.
 *   - Fetching these over HTTP: the server's httpJson adapter tests.
 */
import { describe, expect, it } from 'vitest';

import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import {
  buildDraftOverallMappings,
  buildDraftRaceMappings,
  buildDraftTournamentMappings,
  spoilersRefusalMessage,
} from './bajaAppDraftPresets.testSupport.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import type { FlexMappingConfig } from './flexMappingConfig.js';

/** The moment of the poll in these tests: when the doc's race was ten minutes in. */
const pollMomentMs = 1_760_000_600_000;

/** 26BR's parts of the overall score, as an operator would pick them. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

/**
 * Maps the answers with the mappings and validates every shape the mapping gave: the
 * valid shapes by key, or the first problem (a mapping problem or a validation one).
 */
function mapAndValidate(mappings: FlexMappingConfig, responses: Record<string, unknown>) {
  const result = applyFlexMapping(mappings, responses, pollMomentMs);
  if (!result.ok) {
    return { problems: result.problems, shapes: undefined };
  }
  const shapes: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [shapeKey, mappedShape] of Object.entries(result.shapes)) {
    const validation = validateDataShape(shapeKey as DataShapeKey, mappedShape);
    if (validation.isValid) {
      shapes[shapeKey] = validation.shape;
    } else {
      problems.push(validation.errorMessage);
    }
  }
  return { problems, shapes };
}

describe('the Baja app results API through draft presets', () => {
  it('maps the doc race ten minutes in, with gaps worked out from laps', () => {
    // Arrange: the draft race mappings, the doc's race and a teams list without its cars.
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26SE),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildDraftRaceMappings(), responses);

    // Assert: both shapes valid; the cars in order with their gaps in laps.
    expect(problems, 'the race must map with no problem').toEqual([]);
    expect(shapes?.session, 'the session must be running at 10:00').toMatchObject({
      state: 'green',
      clock: { referenceTimeMs: 600_000, running: true },
    });
    const positions = shapes?.positions as { entries: Array<Record<string, unknown>> };
    expect(
      positions.entries.map((car) => [car.position, car.carNumber, car.laps, car.gapToLeaderLaps]),
      'car 22 must be one lap down and car 33 three',
    ).toEqual([
      [1, 11, 3, undefined],
      [2, 22, 2, 1],
      [3, 33, 0, 3],
    ]);
  });

  it('maps the doc race before its start into a stopped clock at 0:00', () => {
    // Arrange: the doc's 26BR Enduro, never started.
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceBeforeTheStart26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildDraftRaceMappings(), responses);

    // Assert: a valid session at 0, stopped, and no cars.
    expect(problems, 'the race before its start must map with no problem').toEqual([]);
    expect(shapes?.session, 'the clock must be stopped at 0').toMatchObject({
      state: 'pre',
      clock: { referenceTimeMs: 0, running: false },
    });
    expect(shapes?.positions, 'there must be no car yet').toMatchObject({ entries: [] });
  });

  it('maps the real 26BR overall table, the disqualified teams unranked at the end', () => {
    // Arrange: the real 26BR table and teams.
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overall26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(
      buildDraftOverallMappings(partHeadersOf26BR),
      responses,
    );

    // Assert: 51 teams; the leader named from the teams list; the last two disqualified
    // with no rank; the five parts listed.
    expect(problems, 'the table must map with no problem').toEqual([]);
    const standings = shapes?.standings as {
      scoreParts: unknown[];
      entries: Array<Record<string, unknown>>;
    };
    expect(standings.entries, 'all 51 teams must be there').toHaveLength(51);
    expect(standings.entries[0], 'the leader must carry its short names').toMatchObject({
      rank: 1,
      carNumber: 5,
      teamName: 'Poli',
      schoolName: 'Poli',
      points: 816.24,
    });
    expect(
      standings.entries.slice(-2).map((team) => [team.carNumber, team.rank, team.isDisqualified]),
      'cars 46 and 54 must be disqualified with no rank',
    ).toEqual([
      [46, undefined, true],
      [54, undefined, true],
    ]);
    expect(standings.scoreParts, 'the five parts must be listed').toHaveLength(5);
  });

  it('refuses the doc 25SU table during spoilers with the spoilers sentence', () => {
    // Arrange: the doc's 25SU table during spoilers.
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overallDuringSpoilers25SU),
      equipes: { teams: [] },
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(
      buildDraftOverallMappings(partHeadersOf26BR),
      responses,
    );

    // Assert: no shape, and the sentence alone.
    expect(shapes, 'no shape may come from a refused answer').toBeUndefined();
    expect(problems, 'the spoilers sentence must be the only problem').toEqual([
      spoilersRefusalMessage,
    ]);
  });

  const bracketScenarios = [
    // The real 25SU Super Prime: byes and best of 3.
    { name: 'maps the real 25SU Super Prime', fileName: bajaAppFixtureFiles.superPrime25SU },
    // The real 26BR Super Prime: 64 slots, single races until the semifinals.
    { name: 'maps the real 26BR Super Prime', fileName: bajaAppFixtureFiles.superPrime26BR },
    // The made-up bracket with pending sides in its final and third place.
    {
      name: 'maps the made-up 25SU bracket with pending sides',
      fileName: bajaAppFixtureFiles.superPrime25SUWithPendingSlots,
    },
  ];

  it.each(bracketScenarios)('$name', ({ fileName }) => {
    // Arrange: this row's tournament answer.
    const responses = { torneio: readBajaAppFixture(fileName) };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildDraftTournamentMappings(), responses);

    // Assert: valid brackets.
    expect(problems, 'the tournament must map with no problem').toEqual([]);
    expect(shapes?.brackets, 'the brackets must be there').toBeDefined();
  });
});
