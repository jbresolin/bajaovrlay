// @vitest-environment node
/**
 * Every motion token a graphic reads is declared in the theme (packages/theme)
 *
 * What this module is for:
 *   `readMotionTokens` reads the `--motion-*` and `--ease-*` tokens from the page, and a
 *   token that is not there reads as 0 ms (no motion) or `linear`, never a throw. That
 *   rule keeps the air safe, but it also means a token read by the graphics and missing
 *   from ardosia/tokens.css would go unnoticed: the piece would snap instead of animate
 *   and nothing would log it. This test is the check, at test time instead of on air.
 *
 * What these tests prove:
 *   - Every token name in `motionTokenNames` (the list readMotionTokens itself reads
 *     through, so the two cannot drift) is declared in ardosia/tokens.css.
 *   - The reading of tokens.css works: it finds the declarations of a sample text and
 *     really saw the theme's file (a known token is among the names found).
 *
 * What these tests deliberately do not cover:
 *   - The token values (400ms, a cubic-bezier): readMotionTokens.test.ts covers how a
 *     value is read, and the design's motion.md says what each value should be.
 *   - Tokens that are not motion tokens (colours, sizes): a graphic reads those through
 *     `var(--token)` in its CSS, where a missing one is caught by the screenshot tests.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it reads a
 *     file and draws nothing; under jsdom `import.meta.url` is not a file address.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { motionTokenNames } from './readMotionTokens.js';

const tokensFilePath = fileURLToPath(new URL('../ardosia/tokens.css', import.meta.url));

// A custom property being declared: `--name:` at the start of a declaration. A `var(--name)`
// is a use, not a declaration, and has no colon after the name, so it is not matched.
const tokenDeclarationPattern = /(--[a-z0-9-]+)\s*:/g;

/** Lists the names of every custom property a stylesheet text declares, in file order. */
function listTokenNamesDeclaredIn(stylesheetText: string): string[] {
  const tokenNames: string[] = [];
  for (const match of stylesheetText.matchAll(tokenDeclarationPattern)) {
    tokenNames.push(match[1] ?? '');
  }
  return tokenNames;
}

describe('the reading of token declarations', () => {
  it('finds each declared name and leaves a var() use alone', () => {
    // Arrange: a stylesheet as the theme writes one: two declarations, one of them a
    // value built from another token.
    const stylesheetText = [
      ':root {',
      '  --stage-safe-top: 54px;',
      '  --tower-top: calc(var(--stage-safe-top) + var(--clock-height));',
      '}',
    ].join('\n');

    // Act: list the declared names.
    const tokenNames = listTokenNamesDeclaredIn(stylesheetText);

    // Assert: the two declared names, and not the two used inside the calc.
    expect(tokenNames, 'only a `--name:` declaration counts, never a var() use').toEqual([
      '--stage-safe-top',
      '--tower-top',
    ]);
  });

  it('really read the theme file: a token every graphic uses is among the names', () => {
    // Arrange: the theme's tokens.css from disk.
    const tokensFileText = readFileSync(tokensFilePath, 'utf8');

    // Act: list the declared names.
    const tokenNames = listTokenNamesDeclaredIn(tokensFileText);

    // Assert: the panel colour is there, so an empty or wrong file cannot pass for a
    // complete one.
    expect(tokenNames, 'the theme file must declare --panel-base').toContain('--panel-base');
  });
});

describe('ardosia/tokens.css', () => {
  it('declares every motion and ease token readMotionTokens reads', () => {
    // Arrange: the theme's tokens.css from disk and the names the graphics read.
    const tokenNamesDeclared = listTokenNamesDeclaredIn(readFileSync(tokensFilePath, 'utf8'));
    const tokenNamesRead = Object.values(motionTokenNames);

    // Act: find the names read but not declared.
    const tokenNamesMissingFromTheTheme = tokenNamesRead.filter(
      (tokenName) => !tokenNamesDeclared.includes(tokenName),
    );

    // Assert: none is missing; otherwise a graphic would animate at 0 ms with no log line.
    expect(
      tokenNamesMissingFromTheTheme,
      'a token read by readMotionTokens must be declared in the theme, or a piece snaps on air',
    ).toEqual([]);
  });
});
