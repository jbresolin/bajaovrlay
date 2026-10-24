/**
 * Data for the preview page (packages/graphics/team-card)
 *
 * What this module is for:
 *   preview.html shows the team card on its own, for designers, for the screenshot tests
 *   and later for the control page. It shows car 7, Reptiles Baja PUC-Rio, from the 30ª
 *   Competição's real teams, with a stand-in photo and the team's real logo (files inside
 *   this package). The address picks one of the eight combinations of photo, logo and city
 *   and the plate (`?photo=off`, `?logo=off`, `?city=off`, `?plate=off`), or gives the data
 *   whole (`?data=<JSON>`), and picks the stage behind the card (`?stage=grey|black`).
 *
 * What these tests prove:
 *   - Without a query, the preview shows car 7 with everything: the photo, the logo on
 *     its plate and "Rio de Janeiro · RJ".
 *   - Each switch in the address leaves out its part, and they combine.
 *   - With `?data=`, the JSON in the address is used exactly as written; JSON that cannot
 *     be read gives a pt-BR problem to show, not an exception.
 *   - The stage is the design's grey or black when asked for, and the footage stand-in
 *     otherwise.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid team card data; the graphic's own `load` decides that
 *     (teamCardModel.test.ts), so the preview shows the same answer a renderer gets.
 *   - The image files themselves; e2e/teamCardScreenshots.e2e.ts loads them in Chromium.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, createReptilesSample } from './previewData.js';

describe('choosePreviewData', () => {
  it('shows car 7 with its photo, its logo on the plate and its city when the address says nothing', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the whole Reptiles sample, with both images pointing at files of the package.
    expect(choice.isReadable, 'an address without data must be readable').toBe(true);
    const data = choice.isReadable ? (choice.data as Record<string, unknown>) : {};
    expect(
      {
        carNumber: data.carNumber,
        teamName: data.teamName,
        schoolName: data.schoolName,
        city: data.city,
        state: data.state,
        logoOnLightPlate: data.logoOnLightPlate,
      },
      'the sample must be car 7 of the real teams, its logo on the plate',
    ).toEqual({
      carNumber: 7,
      teamName: 'Reptiles Baja PUC-Rio',
      schoolName: 'PUC-Rio',
      city: 'Rio de Janeiro',
      state: 'RJ',
      logoOnLightPlate: true,
    });
    expect(data.carPhotoUrl, 'the photo must be the stand-in file of the package').toMatch(
      /car-photo-stand-in.*\.jpg$/,
    );
    expect(data.logoUrl, 'the logo must be the team’s real logo, a file of the package').toMatch(
      /reptiles-baja-logo.*\.webp$/,
    );
  });

  const switchScenarios = [
    // The design's team-card-sem-foto look with a logo: no photo cell.
    { name: 'leaves out the photo with ?photo=off', query: '?photo=off', absent: ['carPhotoUrl'] },
    // No logo uploaded yet.
    { name: 'leaves out the logo with ?logo=off', query: '?logo=off', absent: ['logoUrl'] },
    // A team with no city in Cadastros: no place line at all.
    {
      name: 'leaves out the city and the state with ?city=off',
      query: '?city=off',
      absent: ['city', 'state'],
    },
    // The shortest card: all three off together.
    {
      name: 'combines the switches',
      query: '?photo=off&logo=off&city=off',
      absent: ['carPhotoUrl', 'logoUrl', 'city', 'state'],
    },
  ];

  it.each(switchScenarios)('$name', ({ query, absent }) => {
    // Arrange: the address query comes from the scenario row above.

    // Act: choose the data.
    const choice = choosePreviewData(query);

    // Assert: the switched-off parts are not in the data at all.
    const data = choice.isReadable ? (choice.data as Record<string, unknown>) : {};
    const presentButSwitchedOff = absent.filter((fieldName) => fieldName in data);
    expect(presentButSwitchedOff, 'a part switched off must be left out of the data').toEqual([]);
  });

  it('takes the logo off its plate with ?plate=off', () => {
    // Arrange: the address asking for the logo on the panel.
    const addressQuery = '?plate=off';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the plate is off and the logo is still there.
    const data = choice.isReadable ? (choice.data as Record<string, unknown>) : {};
    expect(data.logoOnLightPlate, 'the plate must be off').toBe(false);
    expect(typeof data.logoUrl, 'the logo must still be shown').toBe('string');
  });

  it('uses the JSON in ?data= exactly as written', () => {
    // Arrange: car 47 as the control page would send it, in the address.
    const patoBaja = { carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB' };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(patoBaja))}`;

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the data is the address's, untouched.
    expect(choice, 'the address data must be used as written').toEqual({
      isReadable: true,
      data: patoBaja,
    });
  });

  it('gives a pt-BR problem when ?data= is not JSON', () => {
    // Arrange: an address whose data was cut short when copied.
    const addressQuery = '?data=%7B%22carNumber%22%3A7';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: a problem to show, not an exception.
    expect(choice, 'unreadable data must give a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('createReptilesSample', () => {
  it('builds the bare card when every part is switched off', () => {
    // Arrange: every optional part off.
    const choice = { hasPhoto: false, hasLogo: false, hasCity: false, isLogoOnLightPlate: false };

    // Act: build the sample.
    const sample = createReptilesSample(choice);

    // Assert: the car, the team, the school and the plate switch, and nothing else.
    expect(sample, 'the bare sample must carry only what the card needs').toEqual({
      carNumber: 7,
      teamName: 'Reptiles Baja PUC-Rio',
      schoolName: 'PUC-Rio',
      logoOnLightPlate: false,
    });
  });
});
