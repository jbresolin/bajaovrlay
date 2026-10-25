/**
 * The sponsor bug's data and cells (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   sponsorBugModel.ts checks the data `load` and `updateAction` receive and says what the
 *   card is made of: the mark always, the event word when given, and the sponsor cell (the
 *   caption over the sponsor's logo) only when there is a logo. The brief's rule: without a
 *   sponsor logo the card is the mark and the event word alone, never an empty cell.
 *
 * What these tests prove:
 *   - The cells for the four combinations of a sponsor logo and an event word, and that a
 *     caption with no logo is not drawn (it would caption nothing).
 *   - The plate is off unless the data says so, and only matters when there is a logo.
 *   - A word of blanks counts as no word.
 *   - A partial update merges into the current data without touching what it does not
 *     name; a bad one is refused with a pt-BR sentence and changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The DOM those cells become; sponsorBugView.test.ts.
 *   - The manifest saying the same; sponsorBugManifestDataAgreement.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  listSponsorBugCells,
  mergePartialUpdateIntoSponsorBugData,
  type SponsorBugData,
} from './sponsorBugModel.js';

/** The enduro's bug presented by the Diamante sponsor, its logo on the light plate. */
function createEnduroBugWithSponsor(): SponsorBugData {
  return {
    eventWord: 'ENDURO',
    caption: 'Apresentado por',
    sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul',
    sponsorLogoOnLightPlate: true,
  };
}

describe('listSponsorBugCells', () => {
  const cellScenarios = [
    // The design's page: the mark, the word, the caption over the logo on its plate.
    {
      name: 'with a sponsor and the event word, has every cell',
      data: createEnduroBugWithSponsor(),
      expected: {
        hasEventWord: true,
        hasSponsorCell: true,
        hasCaption: true,
        isSponsorLogoOnLightPlate: true,
      },
    },
    // No sponsor this morning: the mark and the word, never an empty cell.
    {
      name: 'without a sponsor logo, is the mark and the event word alone',
      data: { eventWord: 'ENDURO', caption: 'Apresentado por' },
      expected: {
        hasEventWord: true,
        hasSponsorCell: false,
        hasCaption: false,
        isSponsorLogoOnLightPlate: false,
      },
    },
    // A session with no event word (the suspension test): the mark and the sponsor.
    {
      name: 'without the event word, is the mark and the sponsor cell',
      data: { ...createEnduroBugWithSponsor(), eventWord: undefined },
      expected: {
        hasEventWord: false,
        hasSponsorCell: true,
        hasCaption: true,
        isSponsorLogoOnLightPlate: true,
      },
    },
    // Nothing given: the mark alone is still a finished card.
    {
      name: 'with nothing given, is the mark alone',
      data: {},
      expected: {
        hasEventWord: false,
        hasSponsorCell: false,
        hasCaption: false,
        isSponsorLogoOnLightPlate: false,
      },
    },
    // The caption cleared by the operator: the logo stands alone in its cell.
    {
      name: 'with the caption cleared, keeps the logo without a caption',
      data: { ...createEnduroBugWithSponsor(), caption: undefined },
      expected: {
        hasEventWord: true,
        hasSponsorCell: true,
        hasCaption: false,
        isSponsorLogoOnLightPlate: true,
      },
    },
    // A light logo, whose sponsor did not tick the plate.
    {
      name: 'reads a missing plate choice as off',
      data: { ...createEnduroBugWithSponsor(), sponsorLogoOnLightPlate: undefined },
      expected: {
        hasEventWord: true,
        hasSponsorCell: true,
        hasCaption: true,
        isSponsorLogoOnLightPlate: false,
      },
    },
    // An event word of spaces, left by an operator who emptied the field by hand.
    {
      name: 'counts an event word of blanks as no word',
      data: { ...createEnduroBugWithSponsor(), eventWord: '   ' },
      expected: {
        hasEventWord: false,
        hasSponsorCell: true,
        hasCaption: true,
        isSponsorLogoOnLightPlate: true,
      },
    },
  ];

  it.each(cellScenarios)('$name', ({ data, expected }) => {
    // Arrange: the data of this row.

    // Act: list the cells.
    const cells = listSponsorBugCells(data);

    // Assert: exactly these parts are drawn besides the mark.
    expect(cells, 'the bug must be made of these cells').toEqual(expected);
  });
});

describe('mergePartialUpdateIntoSponsorBugData', () => {
  it('takes the sponsor off and keeps the event word, which the update does not name', () => {
    // Arrange: the bug on air with its sponsor.
    const currentData = createEnduroBugWithSponsor();

    // Act: an update that clears the logo, as the renderer sends a cleared field.
    const merged = mergePartialUpdateIntoSponsorBugData(currentData, {
      sponsorLogoUrl: undefined,
    });

    // Assert: no logo now, the word and the caption kept.
    expect(merged, 'only the logo must change').toEqual({
      isValid: true,
      data: { ...createEnduroBugWithSponsor(), sponsorLogoUrl: undefined },
    });
  });

  it('refuses a bad update with a pt-BR sentence and leaves the data as it was', () => {
    // Arrange: the bug on air with its sponsor.
    const currentData = createEnduroBugWithSponsor();

    // Act: an update with the plate written as a word.
    const merged = mergePartialUpdateIntoSponsorBugData(currentData, {
      sponsorLogoOnLightPlate: 'sim',
    });

    // Assert: refused naming the field, and the current data untouched.
    expect(merged, 'a bad update must be refused in pt-BR').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "sponsorLogoOnLightPlate".',
    });
    expect(currentData, 'the current data must not change').toEqual(createEnduroBugWithSponsor());
  });
});
