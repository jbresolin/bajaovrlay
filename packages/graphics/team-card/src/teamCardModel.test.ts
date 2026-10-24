// @vitest-environment node
/**
 * Team card data model (packages/graphics/team-card)
 *
 * What this module is for:
 *   Everything the team card shows comes from one small data object: the car number, the
 *   team, the school and, each optional, the city, the state, the car's photo, the team's
 *   logo and whether that logo sits on a light plate. The renderer sends the whole object
 *   to `load` and then partial changes to `updateAction`. This module checks that data,
 *   merges partial changes in, explains bad data in pt-BR, and says what the card is made
 *   of for given data: which cells exist (photo, logo, place line, plate) and how wide the
 *   card is around its text.
 *
 * What these tests prove:
 *   - The eight combinations of photo, logo and city give the cells the design's eight
 *     motion demos show, and the card's width around the team's text in px with
 *     Ardósia's tokens (read from packages/theme/ardosia/tokens.css itself): 408 px with
 *     both media, 280 with the photo alone, 152 with the logo alone, 24 with neither.
 *   - The place line: "Campinas · SP", the city alone, the state alone, or no line; a
 *     text of blanks counts as missing.
 *   - A logo sits on the light plate only when `logoOnLightPlate` is true; left out, it
 *     reads as false, and a plate without a logo is no cell at all.
 *
 * What these tests deliberately do not cover:
 *   - Checking and merging the data (load's and updateAction's boundary);
 *     teamCardModel.dataChecks.test.ts covers it.
 *   - The width of the team's own text (name, school, place line), which depends on the
 *     face; e2e/teamCardScreenshots.e2e.ts measures the real card in Chromium and checks
 *     it is this frame width plus the text block, for all eight combinations.
 *   - That the manifest's JSON Schema agrees with these rules;
 *     teamCardManifestDataAgreement.test.ts runs the same payloads through both.
 *   - The page: this file runs in plain Node (the pragma on line 1), since it reads the
 *     token file from disk and draws nothing.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import {
  listTeamCardCells,
  measureTeamCardFrameWidthPx,
  type TeamCardData,
  type TeamCardSizes,
  writePlaceLine,
} from './teamCardModel.js';

/** Reads a pixel token (`--team-logo-size: 112px;`) from Ardósia's tokens.css, as a number. */
function readArdosiaPixelToken(tokenName: string): number {
  const resolveLikeNode = createRequire(import.meta.url);
  const tokensCssPath = resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css');
  const tokensCssText = readFileSync(tokensCssPath, 'utf8');
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)px;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in px in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

/** Builds the card's sizes from the tokens the styles use for them, with Ardósia's values. */
function readArdosiaTeamCardSizes(): TeamCardSizes {
  return {
    cardPaddingPx: readArdosiaPixelToken('--space-3'),
    cellGapPx: readArdosiaPixelToken('--space-4'),
    photoWidthPx: readArdosiaPixelToken('--team-photo-width'),
    logoSizePx: readArdosiaPixelToken('--team-logo-size'),
  };
}

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

describe('the team card’s eight combinations of photo, logo and city', () => {
  const combinationScenarios = [
    {
      // The design's team-card page: both media cells around the text, the place line under it.
      name: 'with photo, with logo, with city: both media cells and the place line',
      data: createReptilesTeamCardData(),
      expectedCells: { hasPhotoCell: true, hasLogoCell: true, hasPlaceLine: true },
      expectedFrameWidthPx: 408,
    },
    {
      // A team the Cadastros know no city of: the same width, one line shorter text block.
      name: 'with photo, with logo, without city: both media cells, no place line',
      data: { ...createReptilesTeamCardData(), city: undefined, state: undefined },
      expectedCells: { hasPhotoCell: true, hasLogoCell: true, hasPlaceLine: false },
      expectedFrameWidthPx: 408,
    },
    {
      // A team with a photo but no logo uploaded: the logo cell goes, the card is narrower.
      name: 'with photo, without logo, with city: the photo cell only',
      data: { ...createReptilesTeamCardData(), logoUrl: undefined },
      expectedCells: { hasPhotoCell: true, hasLogoCell: false, hasPlaceLine: true },
      expectedFrameWidthPx: 280,
    },
    {
      // The photo alone beside the chip, the name and the school.
      name: 'with photo, without logo, without city: the photo cell only, no place line',
      data: {
        ...createReptilesTeamCardData(),
        logoUrl: undefined,
        city: undefined,
        state: undefined,
      },
      expectedCells: { hasPhotoCell: true, hasLogoCell: false, hasPlaceLine: false },
      expectedFrameWidthPx: 280,
    },
    {
      // The usual case before photos are handed over: the logo at the right of the text.
      name: 'without photo, with logo, with city: the logo cell only',
      data: { ...createReptilesTeamCardData(), carPhotoUrl: undefined },
      expectedCells: { hasPhotoCell: false, hasLogoCell: true, hasPlaceLine: true },
      expectedFrameWidthPx: 152,
    },
    {
      // The logo alone, no place line.
      name: 'without photo, with logo, without city: the logo cell only, no place line',
      data: {
        ...createReptilesTeamCardData(),
        carPhotoUrl: undefined,
        city: undefined,
        state: undefined,
      },
      expectedCells: { hasPhotoCell: false, hasLogoCell: true, hasPlaceLine: false },
      expectedFrameWidthPx: 152,
    },
    {
      // The design's team-card-sem-foto page: no media, the chip is the card's anchor.
      name: 'without photo, without logo, with city: no media cell, the shorter card',
      data: { ...createBarePatoBajaTeamCardData(), city: 'Pato Branco', state: 'PR' },
      expectedCells: { hasPhotoCell: false, hasLogoCell: false, hasPlaceLine: true },
      expectedFrameWidthPx: 24,
    },
    {
      // The bare minimum: the chip, the name and the school, and only the card's padding.
      name: 'without photo, without logo, without city: the chip, the name and the school',
      data: createBarePatoBajaTeamCardData(),
      expectedCells: { hasPhotoCell: false, hasLogoCell: false, hasPlaceLine: false },
      expectedFrameWidthPx: 24,
    },
  ];

  it.each(combinationScenarios)('$name', ({ data, expectedCells, expectedFrameWidthPx }) => {
    // Arrange: the card's sizes as Ardósia's tokens set them; the data comes from the row.
    const ardosiaSizes = readArdosiaTeamCardSizes();

    // Act: list the cells and measure the card around its text.
    const cells = listTeamCardCells(data);
    const frameWidthPx = measureTeamCardFrameWidthPx(cells, ardosiaSizes);

    // Assert: exactly the cells the design shows for this combination, and its width.
    expect(
      {
        hasPhotoCell: cells.hasPhotoCell,
        hasLogoCell: cells.hasLogoCell,
        hasPlaceLine: cells.hasPlaceLine,
      },
      'the card must have a cell only for what the team has',
    ).toEqual(expectedCells);
    expect(
      frameWidthPx,
      'the card must be its padding, plus each media cell present with its gap, around the text',
    ).toBe(expectedFrameWidthPx);
  });

  it('counts a blank image address as no image, so no empty frame is drawn', () => {
    // Arrange: a team whose photo and logo were cleared to empty text upstream.
    const data = { ...createReptilesTeamCardData(), carPhotoUrl: '', logoUrl: '  ' };

    // Act: list the cells.
    const cells = listTeamCardCells(data);

    // Assert: neither media cell exists.
    expect(cells.hasPhotoCell, 'an empty photo address must give no photo cell').toBe(false);
    expect(cells.hasLogoCell, 'a blank logo address must give no logo cell').toBe(false);
  });
});

describe('the logo’s light plate', () => {
  const plateScenarios = [
    {
      // A dark logo, or one on its own white box: the operator ticked the plate.
      name: 'puts the logo on the plate when logoOnLightPlate is true',
      data: { ...createReptilesTeamCardData(), logoOnLightPlate: true },
      expected: true,
    },
    {
      // A light logo that reads on the slate as it is.
      name: 'leaves the logo on the panel when logoOnLightPlate is false',
      data: { ...createReptilesTeamCardData(), logoOnLightPlate: false },
      expected: false,
    },
    {
      // An item built before the field existed, or a team never marked: the default.
      name: 'reads a missing logoOnLightPlate as false',
      data: { ...createReptilesTeamCardData(), logoOnLightPlate: undefined },
      expected: false,
    },
    {
      // The plate is the logo's background; without a logo there is nothing to put on it.
      name: 'gives no plate when there is no logo, even with logoOnLightPlate true',
      data: { ...createReptilesTeamCardData(), logoUrl: undefined, logoOnLightPlate: true },
      expected: false,
    },
  ];

  it.each(plateScenarios)('$name', ({ data, expected }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: list the cells.
    const cells = listTeamCardCells(data);

    // Assert: the plate is there exactly when a logo is there and the plate is asked for.
    expect(cells.isLogoOnLightPlate, 'the plate must follow logoOnLightPlate and the logo').toBe(
      expected,
    );
  });
});

describe('writePlaceLine', () => {
  const placeLineScenarios = [
    // The everyday case: the city and its state, one line, a middle dot between.
    {
      name: 'joins the city and the state',
      city: 'Campinas',
      state: 'SP',
      expected: 'Campinas · SP',
    },
    // A city the Cadastros hold without its state.
    { name: 'shows the city alone', city: 'Campinas', state: undefined, expected: 'Campinas' },
    // A state with no city: the two letters alone, with no dot before them.
    { name: 'shows the state alone', city: undefined, state: 'SP', expected: 'SP' },
    // Neither: no line at all, so the card is one line shorter.
    {
      name: 'gives no line without either',
      city: undefined,
      state: undefined,
      expected: undefined,
    },
    // A city cleared by typing spaces counts as missing, so no dangling dot.
    { name: 'treats a city of blanks as missing', city: '   ', state: 'SP', expected: 'SP' },
    // Extra spaces around a name from a CSV import are not shown.
    {
      name: 'trims the spaces around the city, as a CSV import may leave them',
      city: 'São Bernardo do Campo ',
      state: 'SP',
      expected: 'São Bernardo do Campo · SP',
    },
  ];

  it.each(placeLineScenarios)('$name', ({ city, state, expected }) => {
    // Arrange: car 7's data with the scenario's city and state.
    const data = { ...createReptilesTeamCardData(), city, state };

    // Act: write the place line.
    const placeLine = writePlaceLine(data);

    // Assert: the line reads as the design writes it, or there is none.
    expect(placeLine, 'the place line must be "city · state", either alone, or nothing').toBe(
      expected,
    );
  });
});
