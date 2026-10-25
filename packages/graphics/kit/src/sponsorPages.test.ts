/**
 * The pages of a sponsor round (packages/graphics/kit)
 *
 * What this module is for:
 *   The sponsor roll shows up to six tiles a page and the intermission's sponsor line up
 *   to four logos (BAJAOVRLAY-46). Both page the sponsors the same way: one level a page,
 *   in the round order (sponsorRound.ts), so a Diamante sponsor never shares a page with an
 *   Apoio one; a level with more sponsors than a page holds takes several pages and shares
 *   its sponsors evenly between them (nine Ouro on pages of four are 3 + 3 + 3, never
 *   4 + 4 + 1), so no sponsor is left alone on a page. Each page carries its level, which
 *   sets its heading and its hold.
 *
 * What these tests prove (a table of named rows):
 *   - The 30ª Competição's real 17 sponsors on pages of six make five pages: Diamante 2,
 *     Ouro 5 + 4, Apoio 5, Realização 1.
 *   - The same 17 on the intermission's pages of four make seven.
 *   - Nine on pages of four are 3 + 3 + 3; thirteen on pages of six are 5 + 4 + 4.
 *   - A list given out of round order is paged in round order, the organiser last, each
 *     level keeping the order it came in.
 *   - No sponsor gives no page.
 *
 * What these tests deliberately do not cover:
 *   - How long each page stays; sponsorRound.test.ts.
 *   - Which sponsors are in the list (a sponsor without a logo is left out by the server);
 *     shared's entityListResolution.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { planSponsorPages, type SponsorPage } from './sponsorPages.js';
import type { SponsorLevel } from './sponsorRound.js';
import { createThe30thCompetitionSponsors } from './the30thCompetitionSponsors.testSupport.js';

/** A sponsor as the pages need it: its name and its level. */
type SponsorOfTheTests = { name: string; level: SponsorLevel };

/** `count` Ouro sponsors, "Ouro 1", "Ouro 2"… */
function buildOuroSponsors(count: number): SponsorOfTheTests[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Ouro ${String(index + 1)}`,
    level: 'ouro' as const,
  }));
}

/** A page as the table writes it: its level and how many sponsors it holds. */
function describePages(pages: SponsorPage<SponsorOfTheTests>[]): string[] {
  return pages.map((page) => `${page.level} ${String(page.sponsors.length)}`);
}

const pagingScenarios = [
  // The design's sponsor roll: the real 17 make five pages.
  {
    name: 'pages the real 17 sponsors in five pages of up to six',
    sponsors: createThe30thCompetitionSponsors(),
    sponsorsPerPage: 6,
    expected: ['diamante 2', 'ouro 5', 'ouro 4', 'apoio 5', 'realizacao 1'],
  },
  // The intermission's line holds four: Ouro and Apoio take more pages.
  {
    name: 'pages the real 17 sponsors in seven lines of up to four',
    sponsors: createThe30thCompetitionSponsors(),
    sponsorsPerPage: 4,
    expected: ['diamante 2', 'ouro 3', 'ouro 3', 'ouro 3', 'apoio 3', 'apoio 2', 'realizacao 1'],
  },
  // motion.md's own example: never 4 + 4 + 1.
  {
    name: 'shares nine Ouro on pages of four as 3 + 3 + 3',
    sponsors: buildOuroSponsors(9),
    sponsorsPerPage: 4,
    expected: ['ouro 3', 'ouro 3', 'ouro 3'],
  },
  // Evenly means the pages differ by one at most, the fuller first.
  {
    name: 'shares thirteen on pages of six as 5 + 4 + 4',
    sponsors: buildOuroSponsors(13),
    sponsorsPerPage: 6,
    expected: ['ouro 5', 'ouro 4', 'ouro 4'],
  },
  // A level that fits one page stays on one page.
  {
    name: 'keeps six Ouro on one page of six',
    sponsors: buildOuroSponsors(6),
    sponsorsPerPage: 6,
    expected: ['ouro 6'],
  },
  // Nothing to show: no page at all, never an empty one.
  { name: 'gives no page for no sponsor', sponsors: [], sponsorsPerPage: 6, expected: [] },
];

describe('planSponsorPages', () => {
  it.each(pagingScenarios)('$name', ({ sponsors, sponsorsPerPage, expected }) => {
    // Arrange: the sponsors and the page size of this row.

    // Act: plan the pages.
    const pages = planSponsorPages(sponsors, sponsorsPerPage);

    // Assert: each page's level and size.
    expect(describePages(pages), 'the pages of the round').toEqual(expected);
  });

  it('pages a list given out of round order in round order, the organiser last', () => {
    // Arrange: SAE Brasil first, then an Apoio, a Diamante and a second Apoio.
    const sponsors: SponsorOfTheTests[] = [
      { name: 'SAE Brasil', level: 'realizacao' },
      { name: 'Osaki', level: 'apoio' },
      { name: 'Bosch', level: 'diamante' },
      { name: 'Criciúma', level: 'apoio' },
    ];

    // Act: plan pages of six.
    const pages = planSponsorPages(sponsors, 6);

    // Assert: Diamante, then Apoio in the order they came, then the organiser.
    expect(
      pages.map((page) => page.sponsors.map((sponsor) => sponsor.name)),
      'round order between levels, list order within one',
    ).toEqual([['Bosch'], ['Osaki', 'Criciúma'], ['SAE Brasil']]);
  });
});
