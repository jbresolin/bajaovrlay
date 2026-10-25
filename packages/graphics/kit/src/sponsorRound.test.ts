/**
 * Every sponsor round: the order, the headings and the holds (packages/graphics/kit)
 *
 * What this module is for:
 *   Every sponsor round on air (the sponsor roll on the full screen, its corner card, the
 *   intermission's sponsor line; BAJAOVRLAY-46) goes Diamante, Ouro, Prata, Bronze, Apoio,
 *   then Realização (SAE Brasil, the organiser) last, each page or sponsor held by its
 *   level's token (`--motion-sponsor-hold-<level>`), Bronze, which has none, by
 *   `--motion-sponsor-hold`. The order, the headings and the holds are written once here.
 *
 * What these tests prove:
 *   - The round order is shared's (the server sorts the list by the same one).
 *   - Each level's heading, in pt-BR caps: "PATROCÍNIO DIAMANTE" … "APOIO", "REALIZAÇÃO".
 *   - Each level's hold is its token's value with the Ardósia tokens on the page: 8 s for
 *     Diamante, 5 s Ouro, 3 s Prata and Apoio, 5 s Realização, and Bronze the general 5 s.
 *   - A level whose token is missing falls back to the general hold, and with no token at
 *     all to Ardósia's value for that level, never to 0.
 *
 * What these tests deliberately do not cover:
 *   - Reading a token; packages/theme tests readMotionTokens.
 *   - Paging a level; sponsorPages.test.ts.
 */
import { sponsorLevelsInRoundOrder } from '@bajaovrlay/shared/sponsorLevels';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  headingOfSponsorLevel,
  readSponsorHoldMsOfLevel,
  sponsorLevelsInTheRound,
} from './sponsorRound.js';

/** The sponsor holds of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaSponsorHoldTokens: Record<string, string> = {
  '--motion-sponsor-hold': '5000ms',
  '--motion-sponsor-hold-diamante': '8000ms',
  '--motion-sponsor-hold-ouro': '5000ms',
  '--motion-sponsor-hold-prata': '3000ms',
  '--motion-sponsor-hold-apoio': '3000ms',
  '--motion-sponsor-hold-realizacao': '5000ms',
};

/** Builds a graphic's element on the page, with the given tokens set on it. */
function createElementWithTokens(tokens: Record<string, string>): HTMLElement {
  const element = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    element.style.setProperty(tokenName, value);
  }
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

describe('the sponsor round', () => {
  it('goes through the levels in shared’s order, the organiser last', () => {
    // Arrange: nothing; the order is a fixed list.

    // Act: read the kit's round.
    const levels = sponsorLevelsInTheRound;

    // Assert: the very list the server sorts by.
    expect(levels, 'one order for the server and every graphic').toBe(sponsorLevelsInRoundOrder);
  });

  const headings = [
    // The four sponsorship levels say "Patrocínio".
    { level: 'diamante' as const, expected: 'PATROCÍNIO DIAMANTE' },
    { level: 'ouro' as const, expected: 'PATROCÍNIO OURO' },
    { level: 'prata' as const, expected: 'PATROCÍNIO PRATA' },
    { level: 'bronze' as const, expected: 'PATROCÍNIO BRONZE' },
    // Support is not a sponsorship level, so it is just "Apoio" (catalogue entry 11).
    { level: 'apoio' as const, expected: 'APOIO' },
    // The organiser closes every round.
    { level: 'realizacao' as const, expected: 'REALIZAÇÃO' },
  ];

  it.each(headings)('heads $level pages with "$expected"', ({ level, expected }) => {
    // Arrange: the level of this row.

    // Act: read its heading.
    const heading = headingOfSponsorLevel(level);

    // Assert: the pt-BR caps of the design.
    expect(heading, 'the heading on air').toBe(expected);
  });
});

describe('readSponsorHoldMsOfLevel', () => {
  const holds = [
    // Diamante stays longest.
    { level: 'diamante' as const, expected: 8000 },
    { level: 'ouro' as const, expected: 5000 },
    // Prata and Apoio alike.
    { level: 'prata' as const, expected: 3000 },
    { level: 'apoio' as const, expected: 3000 },
    // Bronze has no token of its own: the general hold.
    { level: 'bronze' as const, expected: 5000 },
    { level: 'realizacao' as const, expected: 5000 },
  ];

  it.each(holds)(
    'holds a $level page $expected ms with the Ardósia tokens',
    ({ level, expected }) => {
      // Arrange: a graphic element with Ardósia's sponsor holds.
      const element = createElementWithTokens(ardosiaSponsorHoldTokens);

      // Act: read the level's hold.
      const holdMs = readSponsorHoldMsOfLevel(element, level);

      // Assert: the token's value.
      expect(holdMs, `the hold of a ${level} page`).toBe(expected);
    },
  );

  it('follows a level’s token when the theme changes it', () => {
    // Arrange: a theme that holds Diamante 12 s.
    const element = createElementWithTokens({
      ...ardosiaSponsorHoldTokens,
      '--motion-sponsor-hold-diamante': '12000ms',
    });

    // Act: read Diamante's hold.
    const holdMs = readSponsorHoldMsOfLevel(element, 'diamante');

    // Assert: the theme's value, not a number of the kit's.
    expect(holdMs, 'the hold is the theme’s').toBe(12_000);
  });

  it('falls back to the general hold when a level’s token is missing', () => {
    // Arrange: a theme with the general hold at 6 s and no Ouro token.
    const tokensWithoutOuro = Object.fromEntries(
      Object.entries(ardosiaSponsorHoldTokens).filter(
        ([tokenName]) => tokenName !== '--motion-sponsor-hold-ouro',
      ),
    );
    const element = createElementWithTokens({
      ...tokensWithoutOuro,
      '--motion-sponsor-hold': '6000ms',
    });

    // Act: read Ouro's hold.
    const holdMs = readSponsorHoldMsOfLevel(element, 'ouro');

    // Assert: the general hold.
    expect(holdMs, 'a level with no token takes the general hold').toBe(6000);
  });

  it('falls back to Ardósia’s value for the level on a page with no theme, never 0', () => {
    // Arrange: an element with no theme.
    const element = createElementWithTokens({});

    // Act: read every level's hold.
    const holdsMs = sponsorLevelsInTheRound.map((level) =>
      readSponsorHoldMsOfLevel(element, level),
    );

    // Assert: 8, 5, 3, 5, 3 and 5 s.
    expect(holdsMs, 'a page never flips every frame').toEqual([8000, 5000, 3000, 5000, 3000, 5000]);
  });
});
