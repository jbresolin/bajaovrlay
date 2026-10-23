// @vitest-environment node
/**
 * No hard-coded colours or font sizes in the graphics (packages/theme)
 *
 * What this module is for:
 *   Every visual value a graphic draws with lives in ardosia/tokens.css and reaches the
 *   graphic as a CSS custom property (`var(--panel-base)`). That only stays true if no
 *   one writes a colour or a size into a graphic again, so this test is the guard: it
 *   reads every source file of every graphic under packages/graphics/<package>/src and fails,
 *   naming file and line, when it finds a colour (`#1f2937`, `rgb(...)`, `hsl(...)`) or a
 *   font size in pixels (`font-size: 24px`, or the `font:` shorthand with a px size).
 *
 * What these tests prove:
 *   - No source file of any graphic holds a hex colour, an `rgb()` / `rgba()` /
 *     `hsl()` / `hsla()` colour, a `font-size:` in px or a `font:` shorthand with a px
 *     size, outside comments and outside the lines of the allowlist below (meant to stay
 *     empty). A failure names each file and line.
 *   - The search itself works: it reports the right lines of a sample text, with their
 *     numbers; a value inside a comment (a `//` after code, a block comment over several
 *     lines) is not reported, while a value in the code before a `//` is; and it
 *     really went through the graphics' sources (it saw the race clock's and the notice's
 *     styles files and left their tests out).
 *
 * What these tests deliberately do not cover:
 *   - Named colours (`white`, `red`) and sizes in rem or em; the tokens use hex, rgb and
 *     px, and a reviewer catches the rest.
 *   - Tests, test support and the vendored OGraf schema of a graphic: they may spell out
 *     expected values, and the schema is a copy of a published file.
 *   - `preview.html` and the styles of the preview page, deliberately: the guard reads
 *     `src/` only, and the preview page's own chrome (the backdrop that stands in for the
 *     video, the data form) is not on air and may name colours and sizes of its own. The
 *     graphic the preview page shows is drawn by the same `src/` the guard reads.
 *   - A `//` inside a string (a URL, `https://...`): the rest of that line is treated as a
 *     comment and not searched. The graphics' sources hold no such line today.
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
// `rgb(20 25 48 / 0.84)`, `rgba(0, 0, 0, 0.5)`, `hsl(210 40% 20%)`, `hsla(...)`: the
// whole call, so the failure shows the colour as written.
const functionalColourPattern = /\b(?:rgba?|hsla?)\([^)]*\)/;
// `font-size: 24px`, with or without the space; a token (`var(--size-title)`) has no px.
const pixelFontSizePattern = /font-size:\s*\d+(\.\d+)?px/;
// The `font:` shorthand with a px size anywhere in its value: `font: 700 24px/1 sans-serif`.
// `\b` keeps `font-size:` and `font-family:` from matching here (they have no colon
// right after "font").
const pixelFontShorthandPattern = /\bfont:[^;`]*?\d+(\.\d+)?px/;

const patternsOfHardCodedValues = [
  hexColourPattern,
  functionalColourPattern,
  pixelFontSizePattern,
  pixelFontShorthandPattern,
];

// A block comment (`/* ... */`, over any number of lines) or a line comment (`//` to the
// end of its line). A colour may be named in either as an example or a note.
const commentPattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/**
 * Lines allowed to hold a value, as (file path from packages/graphics, exact line text)
 * pairs. Meant to stay empty: add a pair only with a comment saying why the token
 * cannot be used there.
 */
const allowedHardCodedValues: Array<{ filePath: string; lineText: string }> = [];

/** One place where a hard-coded value was found. */
type HardCodedValueFound = { filePath: string; lineNumber: number; value: string };

/**
 * Blanks every comment of a source text, keeping its newlines, so the text that is left
 * has the same line numbers as the file and a value inside a comment is never seen.
 */
function blankOutComments(text: string): string {
  return text.replaceAll(commentPattern, (comment) => comment.replaceAll(/[^\n]/g, ' '));
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

/**
 * Lists every line of a file's text that holds a hard-coded value, comments left out.
 * A line with two kinds of value is reported once per kind, in the order of the patterns.
 */
function findHardCodedValuesInText(filePath: string, text: string): HardCodedValueFound[] {
  const valuesFound: HardCodedValueFound[] = [];
  blankOutComments(text)
    .split('\n')
    .forEach((line, lineIndex) => {
      for (const pattern of patternsOfHardCodedValues) {
        const valueMatch = pattern.exec(line);
        if (valueMatch !== null) {
          valuesFound.push({ filePath, lineNumber: lineIndex + 1, value: valueMatch[0] });
        }
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

const sampleStylesFilePath = 'positions-tower/src/positionsTowerStyles.ts';

/** One sample text and what the search must report for it, as `line — value` pairs. */
type SearchScenario = { name: string; lines: string[]; expectedFindings: string[] };

const searchScenarios: SearchScenario[] = [
  // The first catch the guard was written for: a hex colour and a px font-size.
  {
    name: 'reports a hex colour and a px font-size with their line numbers',
    lines: [
      'export const towerStyles = css`',
      '  .row {',
      '    background: #1f2937;',
      '    color: var(--text);',
      '    font-size: 28px;',
      '  }',
      '`;',
    ],
    expectedFindings: ['3 — #1f2937', '5 — font-size: 28px'],
  },
  // The `font:` shorthand hides a px size in the middle of its value; a reviewer skimming
  // for `font-size` would miss it.
  {
    name: 'reports a font shorthand whose size is in px',
    lines: ['  .caption {', '    font: 700 24px/1 sans-serif;', '  }'],
    expectedFindings: ['2 — font: 700 24px'],
  },
  // A colour written as a function, in each of the four forms CSS has.
  {
    name: 'reports rgb, rgba, hsl and hsla colours',
    lines: [
      '    background: rgb(20 25 48 / 0.84);',
      '    border-color: rgba(255, 255, 255, 0.5);',
      '    color: hsl(210 40% 20%);',
      '    outline-color: hsla(210, 40%, 20%, 0.5);',
    ],
    expectedFindings: [
      '1 — rgb(20 25 48 / 0.84)',
      '2 — rgba(255, 255, 255, 0.5)',
      '3 — hsl(210 40% 20%)',
      '4 — hsla(210, 40%, 20%, 0.5)',
    ],
  },
  // A colour named in a block comment that spans several lines is a note, not a value;
  // the lines inside the comment do not start with `*`, so only real comment parsing
  // leaves them alone.
  {
    name: 'leaves a value inside a block comment over several lines alone',
    lines: [
      '  /* the design used',
      '     #4ade80 and rgb(0 0 0 / 0.5) here',
      '     before the token existed */',
      '  .laps { color: var(--text-laps); }',
    ],
    expectedFindings: [],
  },
  // A `//` comment after code may name a colour as a note on what the token replaced.
  {
    name: 'leaves a value in a // comment after code alone',
    lines: ['  color: var(--text); // was #ffffff in the first draft'],
    expectedFindings: [],
  },
  // The comment is blanked, the code before it is still searched, and the line number is
  // the file's.
  {
    name: 'still reports a value in the code before a // comment',
    lines: ['  .head {', '    background: #003b71; // the brand navy', '  }'],
    expectedFindings: ['2 — #003b71'],
  },
  // A line that only starts with `*` (the body of a doc comment) was all the old guard
  // skipped; the block comment as a whole is what must be left alone.
  {
    name: 'leaves a doc comment alone and keeps the line numbers of what follows it',
    lines: [
      '/**',
      ' * The flag band: the design drew it in #dc2626.',
      ' */',
      'export const flagRed = css`',
      '  .band { background: #dc2626; }',
      '`;',
    ],
    expectedFindings: ['5 — #dc2626'],
  },
  // Things that look close to a value but are not one.
  {
    name: 'leaves an id selector, a token-based size and a test id alone',
    lines: [
      '  #stage { position: absolute; }',
      '  font-size: var(--size-row);',
      '  font-family: var(--font-display);',
      "  const testId = 'race-clock-panel';",
    ],
    expectedFindings: [],
  },
];

describe('the search for hard-coded values', () => {
  it.each(searchScenarios)('$name', ({ lines, expectedFindings }) => {
    // Arrange: a styles file as someone might write it.
    const textOfAStylesFile = lines.join('\n');

    // Act: search it.
    const valuesFound = findHardCodedValuesInText(sampleStylesFilePath, textOfAStylesFile);

    // Assert: exactly the expected places are reported, each with its file and line.
    expect(
      valuesFound.map(describeHardCodedValueFound),
      'each line holding a value outside a comment must be reported with its file and line, and nothing else',
    ).toEqual(
      expectedFindings.map((finding) => `packages/graphics/${sampleStylesFilePath}:${finding}`),
    );
  });

  it('went through the sources of the graphics and left their tests out', () => {
    // Arrange: nothing; the files are listed from packages/graphics.

    // Act: list the paths the guard reads.
    const pathsRead = listSourceFilesOfEveryGraphic();

    // Assert: the race clock's and the notice's styles files are among them, their tests
    // are not, so an empty or shallow search cannot pass for a clean one.
    expect(pathsRead, 'the search must read the race clock’s styles file').toContain(
      join('race-clock', 'src', 'raceClockStyles.ts'),
    );
    expect(pathsRead, 'the search must read the notice’s styles file').toContain(
      join('notice', 'src', 'noticeStyles.ts'),
    );
    expect(pathsRead, 'the search must leave the tests out').not.toContain(
      join('race-clock', 'src', 'raceClockView.test.ts'),
    );
  });
});

describe('packages/graphics/*/src', () => {
  it('holds no colour and no px font size of its own: every value comes from the theme tokens', () => {
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
