/**
 * Refusing a whole answer by a flag (packages/shared)
 *
 * What this module is for:
 *   During an event the organisers may turn spoilers on: the Baja app's results tables
 *   then hide the positions and totals and say `spoilers_active: true`. That answer is
 *   right on its merits, but the stream must not reveal what the organisers hide, so a
 *   mapping may declare `refuseWhen: { path, equals, message }`: the mapping fails with
 *   that one pt-BR message, and the last good snapshot stays on air (rule 4)
 *   (BAJAOVRLAY-53). The message must read as that sentence, not as shape problems.
 *   The other way round, `notOneOf` refuses a value that is none of a list of known words
 *   (gate 2 of PR #38): a race state the preset does not know must not put a flag on air,
 *   so the poll fails loudly, naming the word (`{valor}` in the message), until the preset
 *   learns it.
 *
 * What these tests prove:
 *   - The doc's 25SU table during spoilers fails with exactly the operator's sentence, as
 *     the only problem and as the summary the poll error stores, and says it was refused
 *     by a flag.
 *   - The real 26BR table (spoilers off) is not refused.
 *   - A flag compared by strict equality: the text "true" is not true.
 *   - `notOneOf`: a race state none of the four words is refused with the word in the
 *     sentence (a value that is not a text written as JSON); each of the four is not; a
 *     state missing altogether is left to the mapping's and the shape's own checks.
 *   - The schema takes exactly one of `equals` and `notOneOf`, and a list of at least one.
 *
 * What these tests deliberately do not cover:
 *   - Keeping the last good snapshot: the store does that for every failed poll
 *     (recordDataSourcePoll's tests).
 *   - How "Testar" shows the sentence: DataSourcesPageFlexTest.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';
import {
  bajaAppApiAddress,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
  spoilersRefusalMessage,
} from './presets/bajaApp/bajaAppPresets.js';

/** The moment of the poll in these tests: the 25SU competition's last day. */
const pollMomentMs = Date.UTC(2025, 9, 26, 18, 0, 0);

/** 26BR's parts of the score, which the 26BR table has as headers. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

/** The Baja app's results table preset on 26BR's overall table (BAJAOVRLAY-54). */
function buildOverallMappingsOf26BR() {
  const config = buildBajaAppResultsTableSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    resultadoId: '26BR_GER',
    pointsHeader: 'Total',
    partHeaders: partHeadersOf26BR,
    standingsScope: 'overall',
  });
  return config.mappings;
}

describe('applyFlexMapping, refusing an answer by a flag', () => {
  it('refuses the doc 25SU table during spoilers with the operator’s sentence alone', () => {
    // Arrange: the overall table preset (refused while spoilers_active is true), the doc's
    // 25SU table during spoilers and a teams list.
    const mappings = buildOverallMappingsOf26BR();
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overallDuringSpoilers25SU),
      equipes: { teams: [] },
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: refused by the flag, with the one sentence, not a list of shape problems.
    expect(result, 'the answer must be refused with the sentence alone').toEqual({
      ok: false,
      isRefusedByAFlag: true,
      problems: [spoilersRefusalMessage],
      summary: spoilersRefusalMessage,
    });
  });

  it('does not refuse the real 26BR table, whose spoilers are off', () => {
    // Arrange: the same mapping, the real 26BR table and teams.
    const mappings = buildOverallMappingsOf26BR();
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overall26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: mapped.
    expect(result.ok, 'a table with spoilers off must map').toBe(true);
  });

  it('compares by strict equality, so the text "true" does not refuse', () => {
    // Arrange: a table whose flag came as the text "true", with no row.
    const mappings = buildOverallMappingsOf26BR();
    const table = readBajaAppFixture(bajaAppFixtureFiles.overall26BR);
    const responses = {
      resultado: { ...table, spoilers_active: 'true', rows: [] },
      equipes: { teams: [] },
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: not refused.
    expect(result.ok, '"true" must not equal true').toBe(true);
  });
});

/** The Baja app's race preset on 26BR's Enduro, whose session refuses an unknown state. */
function buildRaceMappingsOf26BR() {
  const config = buildBajaAppRaceSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    provaId: 'END',
    acceptsSimulatedRace: false,
  });
  return config.mappings;
}

/** The doc's race ten minutes in, its clock state replaced (removed for undefined). */
function buildDocRaceWithClockState(state: unknown) {
  const race = readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE);
  const clock = { ...(race.clock as Record<string, unknown>) };
  if (state === undefined) {
    delete clock.state;
  } else {
    clock.state = state;
  }
  return { ...race, clock };
}

describe('applyFlexMapping, refusing a value that is none of the known words', () => {
  it('refuses a race state none of the four words, naming it in the sentence', () => {
    // Arrange: the race preset (its session refuses a state other than waiting, running,
    // red_flag and finished) and the doc's race with a state the API might add later.
    const mappings = buildRaceMappingsOf26BR();
    const responses = {
      corrida: buildDocRaceWithClockState('suspended'),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: refused by the flag, the word read put in the operator's sentence.
    const expectedSentence =
      'Estado de corrida desconhecido: "suspended". Atualize o preset da fonte.';
    expect(result, 'an unknown state must be refused, never mapped to a flag').toEqual({
      ok: false,
      isRefusedByAFlag: true,
      problems: [expectedSentence],
      summary: expectedSentence,
    });
  });

  it('writes a state that is not a text as JSON in the sentence', () => {
    // Arrange: the same preset, the state come as null.
    const mappings = buildRaceMappingsOf26BR();
    const responses = {
      corrida: buildDocRaceWithClockState(null),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: refused, with null written out.
    expect(result.ok ? [] : result.problems, 'null is none of the words').toEqual([
      'Estado de corrida desconhecido: "null". Atualize o preset da fonte.',
    ]);
  });

  const knownStates = [
    // Before the start.
    { state: 'waiting' },
    // Racing.
    { state: 'running' },
    // Stopped by race control; the clock still runs.
    { state: 'red_flag' },
    // Over.
    { state: 'finished' },
  ];

  it.each(knownStates)('does not refuse the known state "$state"', ({ state }) => {
    // Arrange: the same preset, the doc's race in this row's state.
    const mappings = buildRaceMappingsOf26BR();
    const responses = {
      corrida: buildDocRaceWithClockState(state),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: mapped.
    expect(result.ok, 'a known state must map').toBe(true);
  });

  it('leaves a missing state to the mapping’s and the shape’s own checks', () => {
    // Arrange: the same preset, the doc's race with no clock state at all.
    const mappings = buildRaceMappingsOf26BR();
    const responses = {
      corrida: buildDocRaceWithClockState(undefined),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: not the refusal's sentence; the session's missing state is the shape's to
    // refuse (the store validates every shape before it goes on air).
    const isRefusedByTheFlag = !result.ok && result.isRefusedByAFlag;
    expect(isRefusedByTheFlag, 'nothing was read to compare, so the flag did not refuse it').toBe(
      false,
    );
  });
});

describe('FlexMappingConfigSchema, a refusal’s comparison', () => {
  /** A one-mapping config whose refusal is the one given, on the 26BR table preset. */
  function buildMappingsWithRefusal(refuseWhen: Record<string, unknown>) {
    const [standingsMapping] = buildOverallMappingsOf26BR();
    return [{ ...standingsMapping, refuseWhen }];
  }

  const comparisonScenarios = [
    // A refusal by a list of words, as the race preset writes it.
    {
      name: 'accepts a list of known words alone',
      refuseWhen: { path: 'ranking.order', notOneOf: ['desc', 'asc'], message: 'Ordem nova.' },
      expectedIssue: undefined,
    },
    // Both would leave the reader unsure which one refuses.
    {
      name: 'refuses "equals" beside "notOneOf"',
      refuseWhen: {
        path: 'spoilers_active',
        equals: true,
        notOneOf: [false],
        message: 'Spoilers.',
      },
      expectedIssue: {
        path: '0.refuseWhen',
        message: 'A recusa compara de um jeito só: "igual a" ou "não é um destes".',
      },
    },
    // Neither: the refusal would compare with nothing.
    {
      name: 'refuses a refusal comparing with nothing',
      refuseWhen: { path: 'spoilers_active', message: 'Spoilers.' },
      expectedIssue: {
        path: '0.refuseWhen',
        message: 'A recusa compara de um jeito só: "igual a" ou "não é um destes".',
      },
    },
    // An empty list would refuse every answer.
    {
      name: 'refuses an empty list of known words',
      refuseWhen: { path: 'ranking.order', notOneOf: [], message: 'Ordem nova.' },
      expectedIssue: {
        path: '0.refuseWhen.notOneOf',
        message: 'A lista de valores conhecidos da recusa precisa de pelo menos um valor.',
      },
    },
  ];

  it.each(comparisonScenarios)('$name', ({ refuseWhen, expectedIssue }) => {
    // Arrange: the table preset's mapping with this row's refusal.
    const mappings = buildMappingsWithRefusal(refuseWhen);

    // Act: check it as a saved config is checked.
    const parsing = FlexMappingConfigSchema.safeParse(mappings);

    // Assert: the first problem, where and in which words, or none.
    const firstIssue = parsing.error?.issues[0];
    const issueRead =
      firstIssue === undefined
        ? undefined
        : { path: firstIssue.path.map(String).join('.'), message: firstIssue.message };
    expect(issueRead, 'the refusal must be checked as this row says').toEqual(expectedIssue);
  });
});
