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
 *
 * What these tests prove:
 *   - The doc's 25SU table during spoilers fails with exactly the operator's sentence, as
 *     the only problem and as the summary the poll error stores, and says it was refused
 *     by a flag.
 *   - The real 26BR table (spoilers off) is not refused.
 *   - A flag compared by strict equality: the text "true" is not true.
 *
 * What these tests deliberately do not cover:
 *   - Keeping the last good snapshot: the store does that for every failed poll
 *     (recordDataSourcePoll's tests).
 *   - How "Testar" shows the sentence: DataSourcesPageFlexTest.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import {
  buildDraftOverallMappings,
  spoilersRefusalMessage,
} from './bajaAppDraftPresets.testSupport.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';

/** The moment of the poll in these tests: the 25SU competition's last day. */
const pollMomentMs = Date.UTC(2025, 9, 26, 18, 0, 0);

/** 26BR's parts of the score, which the 26BR table has as headers. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

describe('applyFlexMapping, refusing an answer by a flag', () => {
  it('refuses the doc 25SU table during spoilers with the operator’s sentence alone', () => {
    // Arrange: the draft overall mapping (refused while spoilers_active is true), the doc's
    // 25SU table during spoilers and a teams list.
    const mappings = buildDraftOverallMappings(partHeadersOf26BR);
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
    const mappings = buildDraftOverallMappings(partHeadersOf26BR);
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
    const mappings = buildDraftOverallMappings(partHeadersOf26BR);
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
