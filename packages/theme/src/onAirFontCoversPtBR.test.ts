// @vitest-environment node
/**
 * The on-air face draws every pt-BR character the graphics write (packages/theme)
 *
 * What this module is for:
 *   fonts/bebas-neue/bebas-neue-latin-400-normal.woff2 is a subset of Bebas Neue. If a later
 *   re-subset dropped a character, Chromium would draw it in a fallback face, and a word
 *   like "PATROCÍNIO" would go on air with one letter in the wrong type. This test is the
 *   guard: it opens the file, reads its character map and checks a named set.
 *
 * What these tests prove:
 *   - The font maps every character of ptBROnAirCharacters: the 26 letters and the accented
 *     ones of pt-BR in both cases (À Á Â Ã Ç É Ê Í Ó Ô Õ Ú Ü), º and ª, the digits, the
 *     ASCII punctuation and space, and · — – − … A failure names the characters missing.
 *   - The reading itself works: "A" is found and a character the face has never had
 *     (the CJK "世") is not, so the check cannot pass by reading everything as present.
 *
 * What these tests deliberately do not cover:
 *   - How the characters look, or the line box around them; the graphics' screenshots
 *     (the clipped "Í" of PR #28 was a line box, not a missing glyph).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readCodePointsOfWoff2Font } from './woff2CharacterMap.testSupport.js';

const onAirFontFile = fileURLToPath(
  new URL('../fonts/bebas-neue/bebas-neue-latin-400-normal.woff2', import.meta.url),
);

const asciiLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ptBRAccentedCapitals = 'ÀÁÂÃÇÉÊÍÓÔÕÚÜ';
const digits = '0123456789';
const asciiPunctuationAndSpace = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
/** The ordinals, the middle dot of the boards' lines, the dashes, the minus, the ellipsis. */
const typographicMarks = 'ºª·—–−…';

/** Every character a graphic may put on air in pt-BR. */
const ptBROnAirCharacters = [
  asciiLetters,
  ptBRAccentedCapitals,
  ptBRAccentedCapitals.toLowerCase(),
  digits,
  asciiPunctuationAndSpace,
  typographicMarks,
].join('');

describe('the on-air font', () => {
  it('maps every character of ptBROnAirCharacters', () => {
    // Arrange: the font file as the renderer loads it.
    const fontBytes = readFileSync(onAirFontFile);

    // Act: read the characters it draws, and list those of the set it lacks.
    const codePointsDrawn = readCodePointsOfWoff2Font(fontBytes);
    const charactersMissing = [...ptBROnAirCharacters].filter(
      (character) => !codePointsDrawn.has(character.codePointAt(0) ?? -1),
    );

    // Assert: none missing.
    expect(charactersMissing, 'every pt-BR character must be in the on-air face').toEqual([]);
  });

  it('finds "A" and not a character the face never had', () => {
    // Arrange: the font file.
    const fontBytes = readFileSync(onAirFontFile);

    // Act: read the characters it draws.
    const codePointsDrawn = readCodePointsOfWoff2Font(fontBytes);

    // Assert: the capital A is there, the CJK "世" is not.
    expect(
      [codePointsDrawn.has(0x41), codePointsDrawn.has(0x4e16)],
      'the reading tells present from absent',
    ).toEqual([true, false]);
  });
});
