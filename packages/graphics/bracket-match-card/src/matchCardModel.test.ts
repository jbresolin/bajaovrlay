/**
 * The "a seguir" card's data and what it shows of it (packages/graphics/bracket-match-card)
 *
 * What this module is for:
 *   matchCardModel.ts is the boundary check for the data `load` and `updateAction` receive
 *   (Zod), the merge of a partial update, and the look the data asks for: whether there is
 *   a match to show, the round with "MD3" for a best of 3, and for each side its logo (or,
 *   without one, its car-number chip), its team's name and a line of school, city and
 *   state, with the score once the match has started. Every field is optional: the item
 *   reads "Chaves › Partida a seguir" (BAJAOVRLAY-65), and an empty slot sends nothing.
 *
 * What these tests prove:
 *   - A side with a logo shows it (on the light plate when the team chose it); a side
 *     without one shows its car number instead.
 *   - The details line: school, city and state, each left out when not known.
 *   - The score appears once the match has started (a win of a series, a time) and not
 *     before; "MD3" only for a best of N above 1.
 *   - No data, or a match without both teams, reads as nothing to show; an update that
 *     takes the match off the air clears it.
 *
 * What these tests deliberately do not cover:
 *   - The JSON Schema in the manifest; matchCardManifestDataAgreement.test.ts.
 *   - How it looks: the screenshots (e2e/matchCardScreenshots.e2e.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  type MatchCardData,
  mergePartialUpdateIntoMatchCardData,
  parseCompleteMatchCardData,
  readMatchCardLook,
} from './matchCardModel.js';

/** The second semifinal "a seguir": Corisco Baja (32) against Equipe Cactus Baja (13). */
function buildSemifinalUpNext(): MatchCardData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 32,
    carATeamName: 'Corisco Baja',
    carASchoolName: 'UPE',
    carACity: 'Recife',
    carAState: 'PE',
    carALogoUrl: '/media/logo-corisco-baja',
    carBNumber: 13,
    carBTeamName: 'Equipe Cactus Baja',
    carBSchoolName: 'UFERSA-Mos',
    carBCity: 'Mossoró',
    carBState: 'RN',
  };
}

/** Reads the look of complete data, failing the test when the data is refused. */
function readLookOf(data: unknown) {
  const check = parseCompleteMatchCardData(data);
  if (!check.isValid) {
    throw new Error(`the data was refused: ${check.problem}`);
  }
  return readMatchCardLook(check.data);
}

describe('each side of the card', () => {
  it('shows the logo of a team that has one, and the car number of one that has none', () => {
    // Arrange: Corisco with its logo, Cactus without.
    const data = buildSemifinalUpNext();

    // Act: read what the card shows.
    const look = readLookOf(data);

    // Assert: Corisco's logo off the plate; Cactus's number in place of a logo.
    expect(look.match?.cars.map((car) => car.logo), 'a logo, or nothing for the chip').toEqual([
      { url: '/media/logo-corisco-baja', isOnLightPlate: false },
      undefined,
    ]);
    expect(look.match?.cars.map((car) => car.carNumber), 'each car keeps its number').toEqual([
      32, 13,
    ]);
  });

  it('puts a logo on the light plate when the team chose it', () => {
    // Arrange: Corisco's logo marked for the light plate.
    const data = { ...buildSemifinalUpNext(), carALogoOnLightPlate: true };

    // Act: read what the card shows.
    const look = readLookOf(data);

    // Assert: on the plate.
    expect(look.match?.cars[0].logo, 'the logo must go on the light plate').toEqual({
      url: '/media/logo-corisco-baja',
      isOnLightPlate: true,
    });
  });

  const detailsScenarios = [
    // Everything known: school, city and state.
    {
      name: 'writes school, city and state',
      changes: {},
      expected: 'UPE · Recife · PE',
    },
    // A team imported without its place: the school alone.
    {
      name: 'writes the school alone when the place is not known',
      changes: { carACity: undefined, carAState: undefined },
      expected: 'UPE',
    },
    // The city without its state, as a hand-typed record may have it.
    {
      name: 'leaves out the state when only the city is known',
      changes: { carAState: undefined },
      expected: 'UPE · Recife',
    },
  ];

  it.each(detailsScenarios)('$name', ({ changes, expected }) => {
    // Arrange: Corisco with this row's details.
    const data = { ...buildSemifinalUpNext(), ...changes };

    // Act: read what the card shows.
    const look = readLookOf(data);

    // Assert: the details line of the first side.
    expect(look.match?.cars[0].detailsLine, 'the details line must name what is known').toBe(
      expected,
    );
  });
});

describe('the score line', () => {
  const scoreScenarios = [
    {
      // Not started: no score, only the "×" between the teams.
      name: 'shows no score before the match starts',
      changes: {},
      expected: { hasStarted: false, results: [undefined, undefined], seriesTag: 'MD3' },
    },
    {
      // A best of 3 at 1 × 0: the score from the first win.
      name: 'shows the score once a race of the series is won',
      changes: { carAWins: 1, carBWins: 0 },
      expected: { hasStarted: true, results: ['1', '0'], seriesTag: 'MD3' },
    },
    {
      // A timed single race where the first car has run.
      name: 'shows the time of the car that has run in a timed match',
      changes: { bestOf: 1, carATimeMs: 41_870 },
      expected: { hasStarted: true, results: ['41,870', undefined], seriesTag: undefined },
    },
  ];

  it.each(scoreScenarios)('$name', ({ changes, expected }) => {
    // Arrange: the semifinal with this row's results.
    const data = { ...buildSemifinalUpNext(), ...changes };

    // Act: read what the card shows.
    const look = readLookOf(data);

    // Assert: whether the score shows, each side's result, and the series tag.
    expect(
      {
        hasStarted: look.match?.hasStarted,
        results: look.match?.cars.map((car) => car.resultText),
        seriesTag: look.match?.seriesTag,
      },
      'the score must show once the match has started, and only then',
    ).toEqual(expected);
  });
});

describe('nothing to show', () => {
  it('shows nothing for no data, and once an update takes the match off the air', () => {
    // Arrange: an empty "a seguir", and the semifinal whose fields all leave the air.
    const emptyLook = readLookOf({});
    const fieldsLeavingTheAir = Object.fromEntries(
      Object.keys(buildSemifinalUpNext()).map((fieldName) => [fieldName, undefined]),
    );

    // Act: merge the update into the semifinal and read the look.
    const check = mergePartialUpdateIntoMatchCardData(buildSemifinalUpNext(), fieldsLeavingTheAir);
    const lookAfter = check.isValid ? readMatchCardLook(check.data) : undefined;

    // Assert: nothing to show either way.
    expect(emptyLook.match, 'an empty slot shows nothing').toBeUndefined();
    expect(check.isValid, 'an update that clears the match must be accepted').toBe(true);
    expect(lookAfter?.match, 'nothing may stay once the match left the air').toBeUndefined();
  });

  it('refuses a field the card does not know, naming it', () => {
    // Arrange: the bug's short name sent to the card by mistake.
    const data = { ...buildSemifinalUpNext(), carAShortName: 'Corisco' };

    // Act: check the data.
    const check = parseCompleteMatchCardData(data);

    // Assert: refused, naming the unknown field.
    expect(check, 'an unknown field must be refused').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "carAShortName".',
    });
  });
});
