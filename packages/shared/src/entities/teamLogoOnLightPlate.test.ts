/**
 * A team's choice of the light plate for its logo (packages/shared)
 *
 * What this module is for:
 *   The team card puts a dark logo, or one that comes on its own white box, on a small
 *   light plate (BAJAOVRLAY-24). Whether a team's logo needs it is decided by hand, once
 *   per team, in Cadastros or in the CSV: `logoOnLightPlate`, optional, left out meaning no.
 *   Listed apart from entityRecords.test.ts to keep that file under its limit.
 *
 * What these tests prove:
 *   - A team marked for the plate keeps the choice, and a team that says nothing is left
 *     as it is (nothing made up).
 *   - A choice that is not yes or no is refused with a pt-BR sentence naming the field.
 *
 * What these tests deliberately do not cover:
 *   - Reading the choice into a graphic; entityReferenceResolution.test.ts.
 *   - The CSV's "sim" and "não"; the control page's entityCsvImport.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { TeamSchema } from './team.js';

/** Team 42, Baja UFPR, from Curitiba, with its logo. */
function buildTeam42() {
  return {
    carNumber: 42,
    teamName: 'Baja UFPR',
    schoolName: 'UFPR',
    schoolFullName: 'Universidade Federal do Paraná',
    city: 'Curitiba',
    state: 'PR',
    logoMediaId: '9f2c4e6a8b0d1f3e5a7c9b1d3f5e7a9c0b2d4f6e8a0c2e4f6a8b0d2f4e6a8c0b',
  };
}

/** The first message Zod gives for a value, or undefined when it is accepted. */
function readFirstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("a team's light plate choice", () => {
  it('accepts a team whose logo goes on the light plate, and one that says nothing', () => {
    // Arrange: team 42 with its dark logo marked for the plate, and team 7 as a CSV
    // without the column sends it.
    const team42OnThePlate = { ...buildTeam42(), logoOnLightPlate: true };
    const team7FromCsv = { carNumber: 7, teamName: 'Juriti Off-Road', schoolName: 'UDESC' };

    // Act: check both.
    const resultOnThePlate = TeamSchema.safeParse(team42OnThePlate);
    const resultSayingNothing = TeamSchema.safeParse(team7FromCsv);

    // Assert: both accepted; leaving it out means no plate, so nothing is made up.
    expect(resultOnThePlate.data?.logoOnLightPlate, 'the plate choice must be kept').toBe(true);
    expect(resultSayingNothing.data, 'a team with no choice must be left as it is').toEqual(
      team7FromCsv,
    );
  });

  it('refuses a plate choice that is not yes or no, naming the field', () => {
    // Arrange: a CSV cell "talvez" passed on as text.
    const teamWithAWord = { ...buildTeam42(), logoOnLightPlate: 'talvez' };

    // Act: check it.
    const result = TeamSchema.safeParse(teamWithAWord);

    // Assert: refused with the field's pt-BR sentence.
    expect(readFirstMessage(result), 'the reason must name the field in pt-BR').toBe(
      'Logo sobre placa clara: sim ou não.',
    );
  });
});
