// @vitest-environment node
/**
 * No hard-coded colours or font sizes in the graphics (packages/theme)
 *
 * What this module is for:
 *   Every visual value a graphic draws with lives in ardosia/tokens.css and reaches the
 *   graphic as a CSS custom property (`var(--panel-base)`). That only stays true if no
 *   one writes a colour or a size into a graphic again, so this test is the guard: it
 *   reads every source file of every graphic under packages/graphics/<package>/src and fails,
 *   naming file and line, when it finds a hex colour or a `font-size` in pixels.
 *
 * What these tests prove:
 *   - No source file of any graphic holds a hex colour (`#1f2937`, `#fff`) or a
 *     `font-size:` written in px, except on a comment line and except the lines of the
 *     allowlist below (meant to stay empty). A failure names each file and line.
 *   - The search itself works: it reports the right lines of a sample text, leaves a
 *     comment line alone, and it really went through the graphics' sources (it saw the
 *     race clock's styles file and left its tests out).
 *
 * What these tests deliberately do not cover:
 *   - Colours written another way (`rgb(...)`, a named colour) or sizes in rem; the
 *     tokens use hex and px, and a reviewer catches the rest.
 *   - Tests, test support and the vendored OGraf schema of a graphic: they may spell out
 *     expected values, and the schema is a copy of a published file.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it reads files
 *     and draws nothing; under jsdom `import.meta.url` is not a file address.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const graphicsFolder = fileURLToPath(new URL('../../graphics/', import.meta.url));

// A `#` followed by three to eight hex digits and then nothing that could make it a
// longer word, so `#1f2937` and `#fff` are found and `#stage` (an id) is not.
const hexColourPattern = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])/;
// `font-size: 24px`, with or without the space; a token (`var(--size-title)`) has no px.
const pixelFontSizePattern = /font-size:\s*\d+(\.\d+)?px/;

/**
 * Lines allowed to hold a value, as (file path from packages/graphics, exact line text)
 * pairs. Meant to stay empty: add a pair only with a comment saying why the token
 * cannot be used there.
 */
const allowedHardCodedValues: Array<{ filePath: string; lineText: string }> = [];

/** One place where a hard-coded value was found. */
type HardCodedValueFound = { filePath: string; lineNumber: number; value: string };

/** Answers whether a line is a comment, where a colour may be named as an example. */
function isCommentLine(line: string): boolean {
  const trimmedLine = line.trimStart();
  return (
    trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')
  );
}

/** Answers whether a file is a test, test support or the vendored OGraf schema. */
function isTestOrVendoredFile(filePath: string): boolean {
  const isTestOrTestSupport = /\.(test|testSupport)\.ts$/.test(filePath);
  const isVendoredSchema = filePath.includes(`${sep}ograf-schema${sep}`);
  return isTestOrTestSupport || isVendoredSchema;
}

/** Lists every file under a folder, walking into its subfolders. */
function listFilesUnder(folder: string): string[] {
  const filePaths: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = join(folder, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listFilesUnder(entryPath));
    } else {
      filePaths.push(entryPath);
    }
  }
  return filePaths;
}

/**
 * Lists the source files the guard reads: every file under `src/` of every package in
 * packages/graphics, without tests, test support and vendored files. Paths are relative
 * to packages/graphics (`race-clock/src/raceClockStyles.ts`).
 */
function listSourceFilesOfEveryGraphic(): string[] {
  const sourceFilePaths: string[] = [];
  for (const packageEntry of readdirSync(graphicsFolder, { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) {
      continue;
    }
    const sourceFolder = join(graphicsFolder, packageEntry.name, 'src');
    let filesInSourceFolder: string[];
    try {
      filesInSourceFolder = listFilesUnder(sourceFolder);
    } catch {
      // A package folder without src/ yet (only a package.json) has nothing to read.
      continue;
    }
    for (const filePath of filesInSourceFolder) {
      if (!isTestOrVendoredFile(filePath)) {
        sourceFilePaths.push(relative(graphicsFolder, filePath));
      }
    }
  }
  return sourceFilePaths.sort();
}

/** Lists every line of a file's text that holds a hex colour or a px font size. */
function findHardCodedValuesInText(filePath: string, text: string): HardCodedValueFound[] {
  const valuesFound: HardCodedValueFound[] = [];
  text.split('\n').forEach((line, lineIndex) => {
    if (isCommentLine(line)) {
      return;
    }
    const hexColour = hexColourPattern.exec(line);
    if (hexColour !== null) {
      valuesFound.push({ filePath, lineNumber: lineIndex + 1, value: hexColour[0] });
    }
    const pixelFontSize = pixelFontSizePattern.exec(line);
    if (pixelFontSize !== null) {
      valuesFound.push({ filePath, lineNumber: lineIndex + 1, value: pixelFontSize[0] });
    }
  });
  return valuesFound;
}

/** Answers whether a finding is on a line the allowlist names. */
function isOnAnAllowedLine(found: HardCodedValueFound, text: string): boolean {
  const lineText = text.split('\n')[found.lineNumber - 1] ?? '';
  return allowedHardCodedValues.some(
    (allowed) => allowed.filePath === found.filePath && allowed.lineText === lineText,
  );
}

/** Writes a finding the way an editor shows a place: `path:line — value`. */
function describeHardCodedValueFound(found: HardCodedValueFound): string {
  return `packages/graphics/${found.filePath}:${found.lineNumber} — ${found.value}`;
}

describe('the search for hard-coded values', () => {
  it('reports the file, the line and the value for each line that has one', () => {
    // Arrange: a styles file as someone might write it: a colour on line 3, a px font
    // size on line 5, and a colour named on a comment line, which is allowed.
    const textOfAStylesFileWithValues = [
      'export const towerStyles = css`',
      '  .row {',
      '    background: #1f2937;',
      '    color: var(--text);',
      '    font-size: 28px;',
      '    /* the design used #4ade80 here before the token existed */',
      '  }',
      '`;',
    ].join('\n');

    // Act: search it.
    const valuesFound = findHardCodedValuesInText(
      'positions-tower/src/positionsTowerStyles.ts',
      textOfAStylesFileWithValues,
    );

    // Assert: the colour and the font size are reported, the comment line is not.
    expect(
      valuesFound.map(describeHardCodedValueFound),
      'each line holding a hex colour or a px font size must be reported with its file and line',
    ).toEqual([
      'packages/graphics/positions-tower/src/positionsTowerStyles.ts:3 — #1f2937',
      'packages/graphics/positions-tower/src/positionsTowerStyles.ts:5 — font-size: 28px',
    ]);
  });

  it('leaves an id selector and a font size from a token alone', () => {
    // Arrange: lines that look close to a value but are not one.
    const textWithoutValues = [
      '  #stage { position: absolute; }',
      '  font-size: var(--size-row);',
      "  const testId = 'race-clock-panel';",
    ].join('\n');

    // Act: search it.
    const valuesFound = findHardCodedValuesInText(
      'race-clock/src/raceClockStyles.ts',
      textWithoutValues,
    );

    // Assert: nothing is reported.
    expect(valuesFound, 'an id selector and a token-based size must not be reported').toEqual([]);
  });

  it('went through the sources of the graphics and left their tests out', () => {
    // Arrange: nothing; the files are listed from packages/graphics.

    // Act: list the paths the guard reads.
    const pathsRead = listSourceFilesOfEveryGraphic();

    // Assert: the race clock's styles file is among them, its tests are not, so an
    // empty or shallow search cannot pass for a clean one.
    expect(pathsRead, 'the search must read the race clock’s styles file').toContain(
      join('race-clock', 'src', 'raceClockStyles.ts'),
    );
    expect(pathsRead, 'the search must leave the tests out').not.toContain(
      join('race-clock', 'src', 'raceClockView.test.ts'),
    );
  });
});

describe('packages/graphics/*/src', () => {
  it('holds no hex colour and no px font size: every value comes from the theme tokens', () => {
    // Arrange: every source file of every graphic, with its text.
    const sourceFiles = listSourceFilesOfEveryGraphic().map((filePath) => ({
      filePath,
      text: readFileSync(join(graphicsFolder, filePath), 'utf8'),
    }));

    // Act: search each of them, and take out the lines the allowlist names.
    const valuesFound = sourceFiles.flatMap(({ filePath, text }) =>
      findHardCodedValuesInText(filePath, text).filter((found) => !isOnAnAllowedLine(found, text)),
    );

    // Assert: nothing was found. On failure the list below says where to look.
    expect(
      valuesFound.map(describeHardCodedValueFound),
      'a graphic must draw with the theme’s tokens, never with a colour or a size of its own',
    ).toEqual([]);
  });
});
