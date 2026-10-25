/**
 * The sponsor roll's data and pages (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   sponsorRollModel.ts checks the data the roll receives and plans the pages it turns
 *   through, on the kit's planSponsorPages: one level a page, up to six tiles on the full
 *   screen, a level shared evenly between its pages; one sponsor at a time in the corner.
 *
 * What these tests prove (a table of named rows):
 *   - The real 17 sponsors on the full screen make five pages: Diamante 2, Ouro 5 + 4,
 *     Apoio 5, Realização 1; in the corner, seventeen, one sponsor each, in round order.
 *   - Nine Ouro on the full screen share 5 + 4, never 6 + 3; seven Apoio 4 + 3.
 *   - Each page's hold is its level's (8, 5, 5, 3, 5 s with Ardósia's tokens).
 *   - A partial update replaces the list and keeps the rest; a bad one changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The turning on air; sponsor-roll.test.ts.
 */
import { readSponsorHoldMsOfLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import { describe, expect, it } from 'vitest';

import {
  mergePartialUpdateIntoSponsorRollData,
  planSponsorRollPages,
  type SponsorRollData,
  type SponsorRollPage,
} from './sponsorRollModel.js';
import {
  createThe30thCompetitionRoll,
  createThe30thCompetitionSponsors,
  placeTheSponsorHoldsOnTheRoot,
} from './sponsorRollOnThePage.testSupport.js';

/** Each page as the table writes it: its level and how many sponsors it holds. */
function describePages(pages: SponsorRollPage[]): string[] {
  return pages.map((page) => `${page.level} ${String(page.sponsors.length)}`);
}

/** A full-screen roll of `count` sponsors of one level. */
function createRollOfOneLevel(count: number, level: 'ouro' | 'apoio'): SponsorRollData {
  const sponsors = Array.from({ length: count }, (_, index) => ({
    name: `Patrocinador ${String(index + 1)}`,
    level,
    logoUrl: `/media/logo-${String(index + 1)}`,
    logoOnLightPlate: true,
    rollWeight: 5,
  }));
  return { layout: 'fullscreen', sponsors };
}

const pagingScenarios = [
  // The design's own count: the real 17 make five pages.
  {
    name: 'pages the real 17 in five: Diamante 2, Ouro 5 + 4, Apoio 5, Realização 1',
    data: createThe30thCompetitionRoll('fullscreen'),
    expected: ['diamante 2', 'ouro 5', 'ouro 4', 'apoio 5', 'realizacao 1'],
  },
  // Nine on pages of six: shared evenly, never 6 + 3.
  {
    name: 'shares nine Ouro as 5 + 4',
    data: createRollOfOneLevel(9, 'ouro'),
    expected: ['ouro 5', 'ouro 4'],
  },
  // Seven on pages of six: 4 + 3, never 6 + 1.
  {
    name: 'shares seven Apoio as 4 + 3',
    data: createRollOfOneLevel(7, 'apoio'),
    expected: ['apoio 4', 'apoio 3'],
  },
];

describe('planSponsorRollPages', () => {
  it.each(pagingScenarios)('$name', ({ data, expected }) => {
    // Arrange: the roll of this row.

    // Act: plan its pages.
    const pages = planSponsorRollPages(data);

    // Assert: each page's level and size.
    expect(describePages(pages), 'the pages of the round').toEqual(expected);
  });

  it('gives the corner one sponsor a page, all seventeen in round order', () => {
    // Arrange: the 17 in the corner.
    const data = createThe30thCompetitionRoll('corner');

    // Act: plan its pages.
    const pages = planSponsorRollPages(data);

    // Assert: seventeen, the organiser last.
    expect(pages.length, 'one sponsor at a time').toBe(17);
    expect(pages.map((page) => page.sponsors[0]?.name).slice(0, 3), 'Diamante first').toEqual([
      'Bosch',
      'Renault',
      'Certi',
    ]);
    expect(pages.at(-1)?.sponsors[0]?.name, 'the organiser last').toBe('SAE Brasil');
  });

  it('holds each of the five pages by its level', () => {
    // Arrange: Ardósia's holds on the page, an element to read them from, the 17's pages.
    placeTheSponsorHoldsOnTheRoot();
    const element = document.createElement('section');
    document.body.append(element);
    const pages = planSponsorRollPages(createThe30thCompetitionRoll('fullscreen'));

    // Act: read each page's hold.
    const holdsMs = pages.map((page) => readSponsorHoldMsOfLevel(element, page.level));
    element.remove();

    // Assert: 8 s for Diamante, 5 s each Ouro page, 3 s Apoio, 5 s Realização.
    expect(holdsMs, 'each page its level’s time').toEqual([8000, 5000, 5000, 3000, 5000]);
  });
});

describe('mergePartialUpdateIntoSponsorRollData', () => {
  it('replaces the list and keeps the layout and the word', () => {
    // Arrange: the corner on air, and a refreshed list of two.
    const onAir = createThe30thCompetitionRoll('corner');
    const refreshed = createThe30thCompetitionSponsors().slice(0, 2);

    // Act: merge the refresh.
    const check = mergePartialUpdateIntoSponsorRollData(onAir, { sponsors: refreshed });

    // Assert: the new list, the rest as it was.
    expect(check, 'the list follows Cadastros').toEqual({
      isValid: true,
      data: { ...onAir, sponsors: refreshed },
    });
  });

  it('refuses an empty list in pt-BR and changes nothing', () => {
    // Arrange: the corner on air.
    const onAir = createThe30thCompetitionRoll('corner');

    // Act: merge an empty list.
    const check = mergePartialUpdateIntoSponsorRollData(onAir, { sponsors: [] });

    // Assert: refused, the roll as it was.
    expect(check, 'refused').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "sponsors".',
    });
    expect(onAir, 'nothing half-applied').toEqual(createThe30thCompetitionRoll('corner'));
  });
});
