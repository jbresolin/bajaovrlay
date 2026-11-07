/**
 * No value in the repository looks like a real credential (scripts)
 *
 * What this module is for:
 *   GitGuardian scans every PR and flags a "Generic High Entropy Secret" when a test token,
 *   password or key looks real, such as an `openssl rand -hex 16` string. It happened on
 *   PR #34 (API tokens) and on PR #43 (the D200's token in triggerHttpRoute.test.ts), and
 *   each time João had to tag the incidents by hand; none was ever real (BAJAOVRLAY-60).
 *   This test reads every tracked file (`git ls-files`, minus binaries and the lockfile)
 *   and fails on any value that looks like a credential, unless it reads as fake (it
 *   holds "test", "fake", "example" or "placeholder", or is a `<…>` placeholder) or is on
 *   the allow list, scripts/secretLookingValuesAllowed.json. The rules are in
 *   scripts/realLookingSecrets.ts. Test credentials come from each area's test-support
 *   module (apps/server/src/core/apiAccess/fakeApiTokens.testSupport.ts and so on).
 *
 * What these tests prove:
 *   - On the real repository, no tracked file holds a real-looking value off the allow list,
 *     and each failure names the file, the line, the rule and the value's first characters.
 *   - Every allow-list entry still matches a value, so the list cannot hide a file that
 *     has since changed.
 *   - Each rule catches its shape (the token shapes of PRs #34 and #43 among them) and lets
 *     through code that only resembles it: names, paths, CSS properties, fake values.
 *
 * What these tests deliberately do not cover:
 *   - Git history: an old commit keeps its value; GitGuardian's incidents for it are closed
 *     by hand.
 *   - Values built at run time (an obs-websocket salt from randomBytes): nothing is written.
 *   - Whether a value is a real credential: a fake one that looks real fails all the same.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  findSecretLookingValuesInText,
  findSecretLookingValuesOnLine,
  type SecretLookingRuleName,
} from './realLookingSecrets.js';

const repoRootFolder = fileURLToPath(new URL('..', import.meta.url));

// Files never read: the lockfile is integrity hashes from end to end, and these
// extensions are binary (a NUL byte also marks a file as binary, below).
const fileNamesNotToRead = ['pnpm-lock.yaml'];
const binaryExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.webm',
  '.zip',
  '.sqlite',
];

/** One entry of scripts/secretLookingValuesAllowed.json. */
type AllowedSecretLookingValue = { file: string; valueStartsWith: string; reason: string };

/** One value found in the repository, with the file it is in. */
type SecretLookingValueInFile = {
  file: string;
  lineNumber: number;
  ruleName: SecretLookingRuleName;
  value: string;
};

/** Every tracked file a person could have written a value in, as repository paths. */
function listTrackedTextFiles(): string[] {
  const listing = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRootFolder,
    encoding: 'utf8',
  });
  const trackedFiles = listing.split('\0').filter((file) => file !== '');
  return trackedFiles.filter((file) => {
    const fileName = file.split('/').at(-1) ?? file;
    const isNotToRead = fileNamesNotToRead.includes(fileName);
    const isBinaryByExtension = binaryExtensions.some((extension) =>
      fileName.toLowerCase().endsWith(extension),
    );
    const isInstalledCode = file.split('/').includes('node_modules');
    return !isNotToRead && !isBinaryByExtension && !isInstalledCode;
  });
}

/** Every real-looking value in the tracked files, allow list not yet applied. */
function findSecretLookingValuesInTheRepository(): SecretLookingValueInFile[] {
  const found: SecretLookingValueInFile[] = [];
  for (const file of listTrackedTextFiles()) {
    let fileText: string;
    try {
      fileText = readFileSync(join(repoRootFolder, file), 'utf8');
    } catch {
      // Tracked but deleted in the working copy (mid-rename): nothing to read.
      continue;
    }
    const isBinary = fileText.includes('\0');
    if (isBinary) {
      continue;
    }
    for (const value of findSecretLookingValuesInText(fileText)) {
      found.push({ file, ...value });
    }
  }
  return found;
}

/** The allow list, as written in scripts/secretLookingValuesAllowed.json. */
function readAllowedSecretLookingValues(): AllowedSecretLookingValue[] {
  const listText = readFileSync(
    join(repoRootFolder, 'scripts/secretLookingValuesAllowed.json'),
    'utf8',
  );
  const list = JSON.parse(listText) as { allowed: AllowedSecretLookingValue[] };
  return list.allowed;
}

/** Whether an allow-list entry covers a found value: same file, same first characters. */
function isCoveredBy(
  allowedValue: AllowedSecretLookingValue,
  foundValue: SecretLookingValueInFile,
): boolean {
  return (
    allowedValue.file === foundValue.file &&
    foundValue.value.startsWith(allowedValue.valueStartsWith)
  );
}

/**
 * One failure line: file, line, rule and the value's first six characters only, so the
 * test's own output never repeats a whole credential into a CI log.
 */
function describeFoundValue(foundValue: SecretLookingValueInFile): string {
  const firstCharacters = foundValue.value.slice(0, 6);
  return `${foundValue.file}:${foundValue.lineNumber} ${foundValue.ruleName} ("${firstCharacters}…")`;
}

describe('the tracked files of the repository', () => {
  it('hold no real-looking credential off the allow list', () => {
    // Arrange: every real-looking value in the repository, and the allow list.
    const foundValues = findSecretLookingValuesInTheRepository();
    const allowedValues = readAllowedSecretLookingValues();

    // Act: keep the values no allow-list entry covers, one line each.
    const valuesNotAllowed = foundValues.filter(
      (foundValue) => !allowedValues.some((allowedValue) => isCoveredBy(allowedValue, foundValue)),
    );
    const failureLines = valuesNotAllowed.map(describeFoundValue);

    // Assert: none is left. Write a fake value from the area's test-support module
    // ("companion-test-token-0001", "obs-test-password-0001", "fake-…-0001") instead.
    expect(
      failureLines,
      'every credential-looking value must read as fake or be on scripts/secretLookingValuesAllowed.json',
    ).toEqual([]);
  });

  it('are read at all, so an empty listing cannot pass', () => {
    // Arrange, act: list the files the guard reads.
    const trackedTextFiles = listTrackedTextFiles();

    // Assert: this test file and the API tokens' test support are among them.
    expect(trackedTextFiles, 'the guard must read its own test file').toContain(
      'scripts/noRealLookingSecrets.test.ts',
    );
    expect(trackedTextFiles, 'the guard must read the fake API tokens').toContain(
      'apps/server/src/core/apiAccess/fakeApiTokens.testSupport.ts',
    );
  });

  it('keep a value for every allow-list entry, so a stale entry is removed', () => {
    // Arrange: every real-looking value in the repository, and the allow list.
    const foundValues = findSecretLookingValuesInTheRepository();
    const allowedValues = readAllowedSecretLookingValues();

    // Act: keep the entries that cover nothing found.
    const staleEntries = allowedValues.filter(
      (allowedValue) => !foundValues.some((foundValue) => isCoveredBy(allowedValue, foundValue)),
    );
    const staleEntryLines = staleEntries.map(
      (entry) => `${entry.file} "${entry.valueStartsWith}"`,
    );

    // Assert: none is stale.
    expect(staleEntryLines, 'an allow-list entry must still match a value in its file').toEqual(
      [],
    );
  });

  it('give every allow-list entry a reason and six first characters', () => {
    // Arrange: the allow list.
    const allowedValues = readAllowedSecretLookingValues();

    // Act: keep the entries without a reason, or with a prefix other than six characters.
    const entriesWithoutReason = allowedValues.filter(
      (entry) => entry.reason.trim() === '' || entry.valueStartsWith.length !== 6,
    );

    // Assert: none.
    expect(
      entriesWithoutReason,
      'each entry names its file, the first 6 characters and a one-line reason',
    ).toEqual([]);
  });
});

// The shapes of PRs #34 and #43, rebuilt at run time from pieces so that this file never
// holds them whole: a line written with them must fail.
const hexOfSixteen = ['9f3c', '27a1', 'b64e', '5d08'].join('');
const hexOfThirtyTwo = ['3f9c1a7e', '5b2d4c6f', '8a0e1b3d', '5f7a9c2e'].join('');
const lowEntropyHexOfThirtyTwo = '0'.repeat(16) + 'f'.repeat(16);
const basicCredentialsInBase64 = Buffer.from('companion:senha-da-mesa').toString('base64');
const humanMadePassword = ['senha', 'do', 'obs', 'pista', '2026'].join('-');
const shortHumanMadeToken = ['baja', '2026'].join('');

const linesThatMustFail: Array<{
  name: string;
  line: string;
  expectedRule: SecretLookingRuleName;
}> = [
  // PR #43: the D200's token, a 16-digit hex glued to a word.
  {
    name: 'catches the D200 token of PR #43',
    line: `const tokenOfTheD200 = 'd200-mesa-${hexOfSixteen}';`,
    expectedRule: 'hex of 16 or more characters',
  },
  // PR #34: an `openssl rand -hex 16` token in a test-support module.
  {
    name: 'catches the Companion token of PR #34',
    line: `export const companionToken = '${hexOfThirtyTwo}';`,
    expectedRule: 'hex of 16 or more characters',
  },
  // PR #34: a low-entropy hex still reads like a key to a scanner and to a person.
  {
    name: 'catches the all-zeros-then-f token of PR #34',
    line: `    request: { token: '${lowEntropyHexOfThirtyTwo}' },`,
    expectedRule: 'hex of 16 or more characters',
  },
  // A Basic authorization header: base64 of a user and a password.
  {
    name: 'catches base64 credentials in a header',
    line: `      header: 'Basic ${basicCredentialsInBase64}',`,
    expectedRule: 'base64 of 20 or more characters',
  },
  // A short, human-made password given to a password variable (.env style).
  {
    name: 'catches a password in an environment line',
    line: `BAJAOVRLAY_OBS_PASSWORD=${humanMadePassword}`,
    expectedRule: 'value of a credential name',
  },
  // A token too short to be random still looks like someone's real one.
  {
    name: 'catches a short token in a quoted value',
    line: `    const environmentVariables = { BAJAOVRLAY_API_TOKENS: 'companion=${shortHumanMadeToken}' };`,
    expectedRule: 'value of a credential name',
  },
  // A password written into a URL.
  {
    name: 'catches a password inside a URL',
    line: `  url: 'http://usuario:${humanMadePassword}@cronometragem.local:8080/api',`,
    expectedRule: 'password in a URL',
  },
];

const linesThatMustPass: Array<{ name: string; line: string }> = [
  // The spelling every API-token test uses.
  {
    name: 'lets the fake Companion token through',
    line: "export const companionToken = 'companion-test-token-0001';",
  },
  // The spelling every OBS-password test uses.
  {
    name: 'lets the fake OBS password through',
    line: 'BAJAOVRLAY_OBS_PASSWORD=obs-test-password-0001',
  },
  // .env.example tells the operator how to make a real token, as a placeholder.
  {
    name: 'lets a placeholder through',
    line: '# BAJAOVRLAY_API_TOKENS=companion=<openssl rand -hex 16>',
  },
  // Design tokens are CSS custom properties, not credentials.
  {
    name: 'lets a CSS design token through',
    line: "      token: '--motion-strip-hold',",
  },
  // A long camelCase name with numbers is code, not base64.
  {
    name: 'lets a function name with numbers through',
    line: 'const library = buildLibraryWithTeams42And7();',
  },
  // A token read from somewhere else is code, not a value.
  {
    name: 'lets an interpolated bearer header through',
    line: '        Authorization: `Bearer ${companionToken}`,',
  },
  // A long decimal number is not hex.
  {
    name: 'lets a long decimal number through',
    line: "    expect(formatLapTime('12345678901234567890')).toBe('—');",
  },
  // A path with a date is neither hex nor base64.
  {
    name: 'lets a recording path through',
    line: "  recordingId: 'simulador-enduro/2027-03-19T13-00-00',",
  },
];

describe('the rules for a real-looking value', () => {
  it.each(linesThatMustFail)('$name', ({ line, expectedRule }) => {
    // Arrange: the line as given in the table.

    // Act: look for real-looking values on it.
    const foundValues = findSecretLookingValuesOnLine(line, 43);
    const foundRules = foundValues.map((foundValue) => foundValue.ruleName);

    // Assert: the expected rule caught it.
    expect(foundRules, `the line must fail on the rule "${expectedRule}"`).toContain(expectedRule);
  });

  it.each(linesThatMustPass)('$name', ({ line }) => {
    // Arrange: the line as given in the table.

    // Act: look for real-looking values on it.
    const foundValues = findSecretLookingValuesOnLine(line, 1);

    // Assert: nothing is found.
    expect(foundValues, 'the line must pass: it holds nothing that looks real').toEqual([]);
  });
});
