// @vitest-environment node
/**
 * Ardósia's sponsor holds equal shared's table (packages/graphics/kit)
 *
 * What this module is for:
 *   Each sponsor level's hold is written twice on purpose: as theme tokens
 *   (`--motion-sponsor-hold-<level>` in packages/theme/ardosia/tokens.css), which the sponsor
 *   roll and the intermission read on the page, and as a table in shared
 *   (`sponsorHoldMsOfEachLevel`, BAJAOVRLAY-64), which the plain sponsor roll and the server's
 *   auto-out read, since the server cannot read the page's CSS. This test keeps the two equal,
 *   so a hold changed in one place and not the other fails here, not on air.
 *
 * What these tests prove:
 *   - Each level's token in tokens.css holds the table's value; Bronze, which has no token
 *     of its own, the general `--motion-sponsor-hold`.
 *   - The reading of tokens.css works: it really found the file's sponsor tokens.
 *
 * What these tests deliberately do not cover:
 *   - How a graphic reads a token from the page; sponsorRound.test.ts and packages/theme.
 *   - The pass built from the table; shared's sponsorRollPass.test.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1), since it reads a file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sponsorLevelsInRoundOrder } from '@bajaovrlay/shared/sponsorLevels';
import { sponsorHoldMsOfEachLevel } from '@bajaovrlay/shared/sponsorRollPass';
import { describe, expect, it } from 'vitest';

const tokensFilePath = fileURLToPath(new URL('../../../theme/ardosia/tokens.css', import.meta.url));

/** Each level's token name; Bronze reads the general hold (motion.md). */
const holdTokenNameOfEachLevel = {
  diamante: '--motion-sponsor-hold-diamante',
  ouro: '--motion-sponsor-hold-ouro',
  prata: '--motion-sponsor-hold-prata',
  bronze: '--motion-sponsor-hold',
  apoio: '--motion-sponsor-hold-apoio',
  realizacao: '--motion-sponsor-hold-realizacao',
} as const;

/** The value in ms of a `--name: 1234ms;` declaration of the stylesheet, or undefined. */
function readDeclaredMilliseconds(stylesheetText: string, tokenName: string): number | undefined {
  const declarationPattern = new RegExp(`${tokenName}\\s*:\\s*(\\d+)ms\\s*;`);
  const match = declarationPattern.exec(stylesheetText);
  return match === null ? undefined : Number(match[1]);
}

describe('the sponsor holds of Ardósia', () => {
  it('found the sponsor hold tokens in tokens.css', () => {
    // Arrange: the theme's stylesheet as text.
    const stylesheetText = readFileSync(tokensFilePath, 'utf8');

    // Act: read the general hold.
    const generalHoldMs = readDeclaredMilliseconds(stylesheetText, '--motion-sponsor-hold');

    // Assert: it is there, so the comparisons below compare real values.
    expect(generalHoldMs, 'tokens.css must declare --motion-sponsor-hold in ms').toBeDefined();
  });

  it.each(sponsorLevelsInRoundOrder)('holds %s for the time shared’s table says', (level) => {
    // Arrange: the theme's stylesheet and this level's token.
    const stylesheetText = readFileSync(tokensFilePath, 'utf8');
    const tokenName = holdTokenNameOfEachLevel[level];

    // Act: read the token's value.
    const tokenMs = readDeclaredMilliseconds(stylesheetText, tokenName);

    // Assert: the same number the plain roll and the server's auto-out use.
    expect(tokenMs, `${tokenName} must equal sponsorHoldMsOfEachLevel.${level}`).toBe(
      sponsorHoldMsOfEachLevel[level],
    );
  });
});
