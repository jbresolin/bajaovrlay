// @vitest-environment node
/**
 * Team card data checks (packages/graphics/team-card)
 *
 * What this module is for:
 *   The renderer sends the team card's whole data to `load` and partial changes to
 *   `updateAction`. teamCardModel.ts checks that data at the boundary, merges partial
 *   changes in, and explains bad data in pt-BR, so the graphic can answer 400 instead of
 *   throwing.
 *
 * What these tests prove:
 *   - Complete data, and the bare minimum (car, team, school), are accepted as sent.
 *   - Data missing a required field, with a wrong value, or with a field the graphic does
 *     not know is refused with a pt-BR message naming the field.
 *   - A partial update changes only the fields it carries; one that does not mention the
 *     plate leaves the plate as it was; a bad one is refused and changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Which cells the data gives and the card's width; teamCardModel.test.ts covers them.
 *   - That the manifest's JSON Schema agrees with these rules;
 *     teamCardManifestDataAgreement.test.ts runs the same payloads through both.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { describe, expect, it } from 'vitest';

import {
  mergePartialUpdateIntoTeamCardData,
  parseCompleteTeamCardData,
  type TeamCardData,
} from './teamCardModel.js';

/** Builds car 7 with everything the Cadastros hold: Reptiles Baja PUC-Rio, Rio de Janeiro. */
function createReptilesTeamCardData(): TeamCardData {
  return {
    carNumber: 7,
    teamName: 'Reptiles Baja PUC-Rio',
    schoolName: 'PUC-Rio',
    city: 'Rio de Janeiro',
    state: 'RJ',
    carPhotoUrl: '/media/0b6f3c2a-photo-car-7',
    logoUrl: '/media/5d1e9a40-logo-reptiles',
    logoOnLightPlate: true,
  };
}

/** Builds car 47 with only what the card needs: Pato Baja, UTFPR-PB, no city and no media. */
function createBarePatoBajaTeamCardData(): TeamCardData {
  return { carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' };
}

describe('parseCompleteTeamCardData', () => {
  const acceptedDataScenarios = [
    // A team with everything the Cadastros can hold.
    { name: 'accepts a complete team card unchanged', data: createReptilesTeamCardData() },
    // The bare minimum the card needs: the car, the team and the school.
    {
      name: 'accepts the car, the team and the school alone',
      data: createBarePatoBajaTeamCardData(),
    },
  ];

  it.each(acceptedDataScenarios)('$name', ({ data }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteTeamCardData(data);

    // Assert: it is valid and comes back exactly as sent.
    expect(result, 'correct data must be accepted exactly as sent').toEqual({
      isValid: true,
      data,
    });
  });

  const refusedDataScenarios = [
    {
      // The chip is the card's anchor; a card with no car is a mistake upstream.
      name: 'refuses data missing the car number',
      data: { ...createReptilesTeamCardData(), carNumber: undefined },
      expectedProblem: 'Falta o campo obrigatório "carNumber".',
    },
    {
      // The team's name is what the card is about.
      name: 'refuses data missing the team name',
      data: { ...createReptilesTeamCardData(), teamName: undefined },
      expectedProblem: 'Falta o campo obrigatório "teamName".',
    },
    {
      // The school is the line under the name; the design always has it.
      name: 'refuses data missing the school',
      data: { ...createReptilesTeamCardData(), schoolName: undefined },
      expectedProblem: 'Falta o campo obrigatório "schoolName".',
    },
    {
      // Car numbers start at 1; a 0 means an empty number field upstream.
      name: 'refuses car number 0',
      data: { ...createReptilesTeamCardData(), carNumber: 0 },
      expectedProblem: 'Valor inválido no campo "carNumber".',
    },
    {
      // The plate is a switch; text here is a binding to the wrong field.
      name: 'refuses a plate that is not true or false',
      data: { ...createReptilesTeamCardData(), logoOnLightPlate: 'sim' },
      expectedProblem: 'Valor inválido no campo "logoOnLightPlate".',
    },
    {
      // The team entity calls the photo carPhotoUrl; "photoUrl" is a person's, a likely mix-up.
      name: 'refuses a field the graphic does not know, such as a person’s photoUrl',
      data: { ...createReptilesTeamCardData(), photoUrl: '/media/0b6f3c2a-photo-car-7' },
      expectedProblem: 'Campo desconhecido nos dados: "photoUrl".',
    },
    {
      // Something that is not an object at all, such as an empty load.
      name: 'refuses something that is not a data object',
      data: 'Reptiles Baja PUC-Rio',
      expectedProblem: 'Dados inválidos: era esperado um objeto com os dados do cartão de equipe.',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the bad data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteTeamCardData(data);

    // Assert: it is refused with a pt-BR message that names the problem.
    expect(result, 'bad data must be refused with a pt-BR message naming the field').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
  });
});

describe('mergePartialUpdateIntoTeamCardData', () => {
  it('changes only the fields the update carries and keeps the rest', () => {
    // Arrange: car 7's card; the operator uploads a new logo, which reads on the slate.
    const currentData = createReptilesTeamCardData();
    const newLogoUpdate = {
      logoUrl: '/media/9c4d2e71-logo-reptiles-white',
      logoOnLightPlate: false,
    };

    // Act: merge the update into the current data.
    const result = mergePartialUpdateIntoTeamCardData(currentData, newLogoUpdate);

    // Assert: only the logo and the plate changed; the car, the team and the city stay.
    expect(result, 'a partial update must change only the fields it carries').toEqual({
      isValid: true,
      data: {
        ...createReptilesTeamCardData(),
        logoUrl: '/media/9c4d2e71-logo-reptiles-white',
        logoOnLightPlate: false,
      },
    });
  });

  it('keeps the plate as it was when an update does not mention it', () => {
    // Arrange: car 7's card with its logo on the plate; an update fixes the city only.
    const currentData = createReptilesTeamCardData();
    const cityUpdate = { city: 'Gávea' };

    // Act: merge it.
    const result = mergePartialUpdateIntoTeamCardData(currentData, cityUpdate);

    // Assert: the plate is still asked for; a default must never overwrite a sent value.
    expect(result, 'an update without the plate must leave the plate as it was').toEqual({
      isValid: true,
      data: { ...createReptilesTeamCardData(), city: 'Gávea' },
    });
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: an update with a good city and a car number of 0, so a merge that applied
    // fields one by one would leave a half-update.
    const currentData = createReptilesTeamCardData();
    const halfBadUpdate = { city: 'Niterói', carNumber: 0 };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoTeamCardData(currentData, halfBadUpdate);

    // Assert: refused with a pt-BR message; the current data was not changed.
    expect(result, 'a bad update must be refused with a pt-BR message').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "carNumber".',
    });
    expect(currentData, 'a refused update must not apply even its good fields').toEqual(
      createReptilesTeamCardData(),
    );
  });
});
