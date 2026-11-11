/**
 * The control page's face draws every character the page writes (apps/control, BAJAOVRLAY-71)
 *
 * What this module is for:
 *   fonts/inter/inter-latin-wght-normal.woff2 is the Latin subset of Inter, bundled so the
 *   control page looks the same on every machine. A character the subset lacks is drawn by
 *   whatever face the machine has, and that is how the page broke on João's WSL: with
 *   fonts-noto-color-emoji installed, Chromium drew spaces and digits from the emoji face,
 *   each as wide as an emoji. This test is the guard: it reads the file's character map
 *   and every character written in the page's source.
 *
 * What these tests prove:
 *   - The face maps every pt-BR letter (the accented ones in both cases), º and ª, the
 *     digits, the ASCII punctuation and space, and the typographic marks the catalog uses.
 *   - The only characters of the page's source (src/, tests left out) the face lacks are
 *     the six symbols of charactersLeftToTheSystemFaces, each named with where it is drawn.
 *     A new character outside the subset fails here, so whoever adds it decides on purpose.
 *   - The reading itself works: "A" is found and the CJK "世" is not.
 *
 * What these tests deliberately do not cover:
 *   - That the page draws its text in this face, and loads it from its own address;
 *     e2e/controlPageTextInTheBundledFace.e2e.ts, in a real Chromium.
 *   - How the six symbols look in the system's faces: they are marks, not words.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readCodePointsOfWoff2Font } from '@bajaovrlay/theme/woff2CharacterMap.testSupport';
import { describe, expect, it } from 'vitest';

// Paths from this file's folder: under jsdom, Vite would turn `new URL(..., import.meta.url)`
// into the address the page would fetch the file from, not a path on the disk.
const controlPageFontFile = join(import.meta.dirname, 'inter', 'inter-latin-wght-normal.woff2');
const controlPageSourceFolder = join(import.meta.dirname, '..');

const asciiLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ptBRAccentedCapitals = 'ÀÁÂÃÇÉÊÍÓÔÕÚÜ';
const digits = '0123456789';
const asciiPunctuationAndSpace = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
/** Ordinals, the middle dot, the dashes, the ellipsis, the quotes and "›" of the paths. */
const typographicMarks = 'ºª·—–…“”‘’›×';

/** Every character the operator reads in pt-BR. */
const ptBRControlPageCharacters = [
  asciiLetters,
  ptBRAccentedCapitals,
  ptBRAccentedCapitals.toLowerCase(),
  digits,
  asciiPunctuationAndSpace,
  typographicMarks,
].join('');

/**
 * The page's characters outside Inter's Latin subset, drawn by the machine's own symbol
 * face (Segoe UI Symbol on the stream PC, DejaVu Sans on Linux). Fontsource ships Inter in
 * Latin, Latin Extended, Greek, Cyrillic and Vietnamese subsets only, and none holds these.
 */
const charactersLeftToTheSystemFaces = [
  // "←" and "→": the keyboard dialog's arrow keys and the macro steps' "item → camada".
  '←',
  '→',
  // "⋯": the "more actions" button of a shortcut, a macro and a correctable value.
  '⋯',
  // "▲" and "▼": the sort marks of the history table's columns.
  '▲',
  '▼',
  // "☰": the handle that drags a rundown row or a shortcut.
  '☰',
];

/** Lists every source file of the page (.ts and .tsx), tests and test support left out. */
function listControlPageSourceFiles(folder: string): string[] {
  const sourceFiles: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = join(folder, entry.name);
    const isTestFile = entry.name.includes('.test.') || entry.name.includes('.testSupport.');
    if (entry.isDirectory()) {
      sourceFiles.push(...listControlPageSourceFiles(entryPath));
    } else if (/\.tsx?$/.test(entry.name) && !isTestFile) {
      sourceFiles.push(entryPath);
    }
  }
  return sourceFiles;
}

/** The characters of `text` the font does not map, each once, in code point order. */
function listCharactersTheFontLacks(text: string, codePointsDrawn: Set<number>): string[] {
  const charactersLacking = new Set<string>();
  for (const character of text) {
    const isLineBreakOrTab = character === '\n' || character === '\r' || character === '\t';
    if (!isLineBreakOrTab && !codePointsDrawn.has(character.codePointAt(0) ?? -1)) {
      charactersLacking.add(character);
    }
  }
  return [...charactersLacking].sort(
    (first, second) => (first.codePointAt(0) ?? 0) - (second.codePointAt(0) ?? 0),
  );
}

describe('the control page font', () => {
  it('maps every pt-BR letter, digit and punctuation mark the operator reads', () => {
    // Arrange: the font file as the page loads it.
    const fontBytes = readFileSync(controlPageFontFile);

    // Act: read the characters it draws, and list those of the set it lacks.
    const codePointsDrawn = readCodePointsOfWoff2Font(fontBytes);
    const charactersMissing = listCharactersTheFontLacks(
      ptBRControlPageCharacters,
      codePointsDrawn,
    );

    // Assert: none missing.
    expect(charactersMissing, 'every pt-BR character must be in the control page face').toEqual([]);
  });

  it('lacks only the named symbols among the characters of the page’s source', () => {
    // Arrange: the font file and the text of every source file of the page.
    const fontBytes = readFileSync(controlPageFontFile);
    const allSourceText = listControlPageSourceFiles(controlPageSourceFolder)
      .map((sourceFile) => readFileSync(sourceFile, 'utf8'))
      .join('\n');

    // Act: list the characters of the source the face does not draw.
    const codePointsDrawn = readCodePointsOfWoff2Font(fontBytes);
    const charactersMissing = listCharactersTheFontLacks(allSourceText, codePointsDrawn);

    // Assert: exactly the six symbols left to the system's faces, no more and no fewer.
    expect(
      charactersMissing,
      'a character outside the bundled face must be added to charactersLeftToTheSystemFaces on purpose',
    ).toEqual(charactersLeftToTheSystemFaces);
  });

  it('finds "A" and not a character the face never had', () => {
    // Arrange: the font file.
    const fontBytes = readFileSync(controlPageFontFile);

    // Act: read the characters it draws.
    const codePointsDrawn = readCodePointsOfWoff2Font(fontBytes);

    // Assert: the capital A is there, the CJK "世" is not.
    expect(
      [codePointsDrawn.has(0x41), codePointsDrawn.has(0x4e16)],
      'the reading tells present from absent',
    ).toEqual([true, false]);
  });
});
