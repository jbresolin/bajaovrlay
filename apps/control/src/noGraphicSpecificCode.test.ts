/**
 * No graphic-specific code in the control page (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-14 every form of the control page is generated from the graphic's
 *   manifest, so a new graphic costs no control-page code. That only stays true if no
 *   one writes a rule for one graphic into the page again. The race clock was the graphic
 *   that had such rules, so this test is the guard: it reads every file under
 *   apps/control/src and fails if the race clock's id or its most particular field name
 *   comes back.
 *
 * What these tests prove:
 *   - No file under apps/control/src contains `race-clock` or `referenceWallClockMs`,
 *     except the pt-BR catalog (src/i18n/) and the tests and their support files
 *     (*.test.ts, *.test.tsx, *.testSupport.ts, *.testSupport.tsx). A failure names each
 *     file and line.
 *   - One exception, spelled out: features/playout/timeOnScreenOfClockOnAir.ts may hold
 *     `referenceWallClockMs`, because that is also the name of a property of the shared
 *     ClockReading (packages/shared/src/clock) which the shared clock sum takes. The
 *     file fills that property from a key found in the manifest; it reads no graphic's
 *     data under that name. The graphic's id is still refused there.
 *   - The search itself works: it reports the right lines of a text that has the words,
 *     and it really went through the page's files (it saw the shell and a feature file).
 *
 * What these tests deliberately do not cover:
 *   - Graphic-specific code written without those two words (a rule keyed on a title,
 *     for example); that is for the reviewer to catch.
 *   - Files outside apps/control/src (the e2e folder drives the real race clock by name
 *     on purpose).
 */
import { describe, expect, it } from 'vitest';

// The two words that give race clock code away: the graphic's id and the name of its
// wall-clock reference field.
const wordsOnlyTheRaceClockUses = ['race-clock', 'referenceWallClockMs'];

// Every file under apps/control/src as text, by its path from this folder
// (`./app/AppShell.tsx`). Vite reads them when the test file is loaded; `?raw` means
// "the file's text, not its code". This file is not in the list (a file cannot read
// itself this way), which does no harm: as a test it may name the race clock anyway.
// Node's own file functions are not used because this package is typed for the browser.
const textOfEveryFileUnderSrc: Record<string, string> = import.meta.glob('./**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// The one file that hands the shared clock sum its reading, and the one word it may
// hold: the name of the ClockReading property for the moment of the reading. Remove
// this exception if packages/shared ever gives that property a name of its own.
const fileThatBuildsTheSharedClockReading = './features/playout/timeOnScreenOfClockOnAir.ts';
const propertyNameOfTheSharedClockReading = 'referenceWallClockMs';

/** One place where a race clock word was found. */
type ForbiddenWordFound = { filePath: string; lineNumber: number; word: string };

/** Answers whether a finding is the shared ClockReading's property name in the one file allowed to hold it. */
function isSharedClockReadingPropertyInItsOneFile(found: ForbiddenWordFound): boolean {
  const isTheOneFile = found.filePath === fileThatBuildsTheSharedClockReading;
  const isThePropertyName = found.word === propertyNameOfTheSharedClockReading;
  return isTheOneFile && isThePropertyName;
}

/** Answers whether a file may name the race clock: the catalog, tests and test support. */
function mayFileNameTheRaceClock(filePath: string): boolean {
  const isInTheCatalogFolder = filePath.startsWith('./i18n/');
  const isTestOrTestSupport = /\.(test|testSupport)\.tsx?$/.test(filePath);
  return isInTheCatalogFolder || isTestOrTestSupport;
}

/** Lists every line of a file's text that holds one of the race clock's words. */
function findRaceClockWordsInText(filePath: string, text: string): ForbiddenWordFound[] {
  const wordsFound: ForbiddenWordFound[] = [];
  const lines = text.split('\n');
  lines.forEach((line, lineIndex) => {
    for (const word of wordsOnlyTheRaceClockUses) {
      if (line.includes(word)) {
        wordsFound.push({ filePath, lineNumber: lineIndex + 1, word });
      }
    }
  });
  return wordsFound;
}

/** Writes a finding the way an editor shows a place: `path:line — word`. */
function describeForbiddenWordFound(found: ForbiddenWordFound): string {
  return `apps/control/src/${found.filePath.replace('./', '')}:${found.lineNumber} — ${found.word}`;
}

describe('the search for race clock words', () => {
  it('reports the file, the line and the word for each line that has one', () => {
    // Arrange: a small file as someone might write it, with the id on line 2 and the
    // field name on line 4.
    const textOfAFileWithRaceClockRules = [
      'export function isRaceClock(graphicId: string): boolean {',
      "  return graphicId === 'race-clock';",
      '}',
      'const fieldToStamp = data.referenceWallClockMs;',
    ].join('\n');

    // Act: search it.
    const wordsFound = findRaceClockWordsInText(
      './features/playout/raceClockRules.ts',
      textOfAFileWithRaceClockRules,
    );

    // Assert: both lines are reported, written as path and line.
    expect(
      wordsFound.map(describeForbiddenWordFound),
      'each line holding a race clock word must be reported with its file and line number',
    ).toEqual([
      'apps/control/src/features/playout/raceClockRules.ts:2 — race-clock',
      'apps/control/src/features/playout/raceClockRules.ts:4 — referenceWallClockMs',
    ]);
  });

  it('lets the shared clock reading’s property name pass in one file only, and nothing else there', () => {
    // Arrange: the same two lines found in the file that builds the shared reading and
    // in another file of the same folder.
    const textWithBothWords = [
      'return { referenceWallClockMs: referenceMomentMs };',
      "const isTheClock = graphic.id === 'race-clock';",
    ].join('\n');
    const foundInTheOneFile = findRaceClockWordsInText(
      './features/playout/timeOnScreenOfClockOnAir.ts',
      textWithBothWords,
    );
    const foundInAnotherFile = findRaceClockWordsInText(
      './features/playout/QuickEditForm.tsx',
      textWithBothWords,
    );

    // Act: take out the findings the exception covers.
    const stillForbidden = [...foundInTheOneFile, ...foundInAnotherFile].filter(
      (found) => !isSharedClockReadingPropertyInItsOneFile(found),
    );

    // Assert: only the property name in the one file passes. The graphic's id there,
    // and both words anywhere else, are still reported.
    expect(
      stillForbidden.map(describeForbiddenWordFound),
      'the exception must cover one word in one file and nothing more',
    ).toEqual([
      'apps/control/src/features/playout/timeOnScreenOfClockOnAir.ts:2 — race-clock',
      'apps/control/src/features/playout/QuickEditForm.tsx:1 — referenceWallClockMs',
      'apps/control/src/features/playout/QuickEditForm.tsx:2 — race-clock',
    ]);
  });

  it('went through the files of the control page', () => {
    // Arrange: nothing; the files were read when this test file was loaded.

    // Act: list the paths that were read.
    const pathsRead = Object.keys(textOfEveryFileUnderSrc);

    // Assert: the shell of the page and a file three folders down are among them, so an
    // empty or shallow search cannot pass for a clean one.
    expect(pathsRead, 'the search must have read the page shell').toContain('./app/AppShell.tsx');
    expect(pathsRead, 'the search must reach files inside the feature folders').toContain(
      './features/playout/QuickEditPanel.tsx',
    );
  });
});

describe('apps/control/src', () => {
  it('names the race clock only in the pt-BR catalog, in tests and in test support', () => {
    // Arrange: every file under apps/control/src that is not allowed to name the race clock.
    const filesThatMustNotNameTheRaceClock = Object.entries(textOfEveryFileUnderSrc).filter(
      ([filePath]) => !mayFileNameTheRaceClock(filePath),
    );

    // Act: search each of them for the race clock's words, and take out the one
    // exception (the shared clock reading's property name in the file that builds it).
    const wordsFound = filesThatMustNotNameTheRaceClock
      .flatMap(([filePath, text]) => findRaceClockWordsInText(filePath, text))
      .filter((found) => !isSharedClockReadingPropertyInItsOneFile(found));

    // Assert: nothing was found. On failure the list below says where to look.
    expect(
      wordsFound.map(describeForbiddenWordFound),
      'the control page must hold no code written for one graphic: forms come from the manifest',
    ).toEqual([]);
  });
});
