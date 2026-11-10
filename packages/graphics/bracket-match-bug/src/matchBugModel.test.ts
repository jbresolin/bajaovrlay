/**
 * The match bug's data and what it shows of it (packages/graphics/bracket-match-bug)
 *
 * What this module is for:
 *   matchBugModel.ts is the boundary check for the data `load` and `updateAction` receive
 *   (Zod), the merge of a partial update, and the look the data asks for: whether there is
 *   a match to show, the round with "MD3" for a best of 3, each car's chip, short name and
 *   result cell (its wins in a series, its time in a timed run), and which car won. Every
 *   field is optional: the item reads "Chaves › Partida agora", and an empty "agora"
 *   sends nothing, so the bug must show nothing rather than refuse.
 *
 * What these tests prove:
 *   - Before, during (a best of 3 at 1 × 1) and after a match: the results and the
 *     winner as the screen shows them.
 *   - A timed run shows each car's time as the scoring writes it; a single race with
 *     nothing yet shows no result cell; "MD3" appears only for a best of N above 1.
 *   - No data, or a match without both cars, reads as nothing to show.
 *   - The corner defaults to top-left, beside the sponsor bug.
 *   - A field the bug does not know is refused, naming it; an update that takes a field
 *     off the air (the renderer sends it as undefined) clears it.
 *
 * What these tests deliberately do not cover:
 *   - The JSON Schema in the manifest; matchBugManifestDataAgreement.test.ts runs the same
 *     payloads through both.
 *   - How it looks: the screenshots (e2e/matchBugScreenshots.e2e.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  type MatchBugData,
  mergePartialUpdateIntoMatchBugData,
  parseCompleteMatchBugData,
  readMatchBugLook,
} from './matchBugModel.js';

/** The second semifinal before it starts: Corisco (47) against Pequi (12), a best of 3. */
function buildSemifinalBeforeItStarts(): MatchBugData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 47,
    carAShortName: 'Corisco',
    carBNumber: 12,
    carBShortName: 'Pequi',
  };
}

/** Reads the look of complete data, failing the test when the data is refused. */
function readLookOf(data: unknown) {
  const check = parseCompleteMatchBugData(data);
  if (!check.isValid) {
    throw new Error(`the data was refused: ${check.problem}`);
  }
  return readMatchBugLook(check.data);
}

describe('the match on the bug', () => {
  const matchScenarios = [
    {
      // Before: a best of 3 at 0 × 0 shows its zeros, so the score has its place already.
      name: 'shows a best of 3 before it starts at 0 × 0, with "MD3"',
      data: buildSemifinalBeforeItStarts(),
      expected: {
        seriesTag: 'MD3',
        results: ['0', '0'],
        outcomes: ['undecided', 'undecided'],
      },
    },
    {
      // During: one race each.
      name: 'shows a best of 3 at 1 × 1 while it runs',
      data: { ...buildSemifinalBeforeItStarts(), carAWins: 1, carBWins: 1 },
      expected: {
        seriesTag: 'MD3',
        results: ['1', '1'],
        outcomes: ['undecided', 'undecided'],
      },
    },
    {
      // After: Pequi took the third race; the winner is marked, the loser dimmed.
      name: 'marks the winner once the source names one',
      data: { ...buildSemifinalBeforeItStarts(), carAWins: 1, carBWins: 2, winnerCarNumber: 12 },
      expected: {
        seriesTag: 'MD3',
        results: ['1', '2'],
        outcomes: ['loser', 'winner'],
      },
    },
    {
      // A timed quarter-final: each car's time as the scoring writes it, no "MD3".
      name: "shows each car's time in a timed run",
      data: {
        roundName: 'Quartas de final',
        carANumber: 47,
        carAShortName: 'Corisco',
        carATimeMs: 41_870,
        carBNumber: 12,
        carBShortName: 'Pequi',
        carBTimeMs: 63_215,
        winnerCarNumber: 47,
      },
      expected: {
        seriesTag: undefined,
        results: ['41,870', '1:03,215'],
        outcomes: ['winner', 'loser'],
      },
    },
    {
      // A single race not yet run: nothing to put in the result cells.
      name: 'shows no result cells for a single race with nothing yet',
      data: { ...buildSemifinalBeforeItStarts(), bestOf: 1 },
      expected: {
        seriesTag: undefined,
        results: [undefined, undefined],
        outcomes: ['undecided', 'undecided'],
      },
    },
  ];

  it.each(matchScenarios)('$name', ({ data, expected }) => {
    // Arrange: the match as the item's bindings deliver it (built above).

    // Act: read what the bug shows.
    const look = readLookOf(data);

    // Assert: the tag, each car's result cell and outcome.
    expect(look.match, 'there is a match to show').toBeDefined();
    expect(
      {
        seriesTag: look.match?.seriesTag,
        results: look.match?.cars.map((car) => car.resultText),
        outcomes: look.match?.cars.map((car) => car.outcome),
      },
      'the bug must show the series, the results and the winner as the source has them',
    ).toEqual(expected);
  });

  it('reads the round and both cars in order, car A on the left', () => {
    // Arrange: the semifinal before it starts.
    const data = buildSemifinalBeforeItStarts();

    // Act: read what the bug shows.
    const look = readLookOf(data);

    // Assert: the round over "47 Corisco … Pequi 12".
    expect(look.match?.roundName, 'the round goes over the cars').toBe('Semifinal');
    expect(
      look.match?.cars.map((car) => [car.carNumber, car.shortName]),
      'car A on the left, car B on the right',
    ).toEqual([
      [47, 'Corisco'],
      [12, 'Pequi'],
    ]);
  });
});

describe('nothing to show', () => {
  const emptyScenarios = [
    // An empty "agora": the item sends no field at all.
    { name: 'shows nothing for no data at all', data: {} },
    // A match only half delivered (the second car's name left out): never half a match.
    {
      name: 'shows nothing for a match without its second car',
      data: { roundName: 'Semifinal', carANumber: 47, carAShortName: 'Corisco', carBNumber: 12 },
    },
  ];

  it.each(emptyScenarios)('$name', ({ data }) => {
    // Arrange: the data as the item delivers it (above).

    // Act: read what the bug shows.
    const look = readLookOf(data);

    // Assert: no match: the bug draws nothing.
    expect(look.match, 'a match is shown only with both cars').toBeUndefined();
  });
});

describe('the corner', () => {
  it('defaults to top-left, beside the sponsor bug', () => {
    // Arrange: a match with no corner chosen.
    const data = buildSemifinalBeforeItStarts();

    // Act: read the look.
    const look = readLookOf(data);

    // Assert: top-left.
    expect(look.corner, 'the default corner is beside the sponsor bug').toBe('top-left');
  });
});

describe('refused data and updates', () => {
  it('refuses a field the bug does not know, naming it', () => {
    // Arrange: a typo of the car's short name.
    const data = { ...buildSemifinalBeforeItStarts(), carAShortname: 'Corisco' };

    // Act: check the data.
    const check = parseCompleteMatchBugData(data);

    // Assert: refused, naming the unknown field.
    expect(check, 'an unknown field must be refused').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "carAShortname".',
    });
  });

  it('merges the wins of an update and keeps the rest', () => {
    // Arrange: the semifinal on air before it starts.
    const current = buildSemifinalBeforeItStarts();

    // Act: the first race goes to Corisco.
    const check = mergePartialUpdateIntoMatchBugData(current, { carAWins: 1 });

    // Assert: the wins arrive, the names stay.
    expect(check, 'an update merges into the data on air').toEqual({
      isValid: true,
      data: { ...current, carAWins: 1 },
    });
  });

  it('clears the fields an update takes off the air', () => {
    // Arrange: the semifinal on air; then "agora" is emptied, and the renderer sends every
    // field that left the air as undefined.
    const current = buildSemifinalBeforeItStarts();
    const update = {
      roundName: undefined,
      bestOf: undefined,
      carANumber: undefined,
      carAShortName: undefined,
      carBNumber: undefined,
      carBShortName: undefined,
    };

    // Act: merge the update and read the look.
    const check = mergePartialUpdateIntoMatchBugData(current, update);
    const look = check.isValid ? readMatchBugLook(check.data) : undefined;

    // Assert: accepted, and nothing to show any more.
    expect(check.isValid, 'an update that clears the match must be accepted').toBe(true);
    expect(look?.match, 'the bug must show nothing once the match left the air').toBeUndefined();
  });
});
