/**
 * No unseeded randomness in the simulator (apps/server)
 *
 * What this module is for:
 *   The simulated race must be the same race at the same moment, at every poll, after
 *   a restart and in every test. One call to Math.random anywhere in the simulator's
 *   folder would break that quietly, so this test reads every file of the folder.
 *
 * What these tests prove:
 *   - No other file of adapters/simulator/ (code, tests, data, README) mentions
 *     Math.random.
 *   - The seeded generator, seededRandom.ts, is in the folder to use instead.
 *
 * What these tests deliberately do not cover:
 *   - Other sources of a changing answer, such as Date.now (the adapter reads time only
 *     from the poll context, which simulatorAdapter.test.ts drives with a fixed clock).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const simulatorFolder = import.meta.dirname;
const forbiddenCall = 'Math.random';
// This test names the call it looks for, so it is the one file left out of the search.
const thisTestFileName = 'simulatorHasNoMathRandom.test.ts';

describe('the simulator folder', () => {
  it('never calls Math.random in any file', () => {
    // Arrange: every file of the simulator folder but this test.
    const fileNames = readdirSync(simulatorFolder).filter(
      (fileName) => fileName !== thisTestFileName,
    );

    // Act: keep the files that mention Math.random.
    const filesWithMathRandom = fileNames.filter((fileName) =>
      readFileSync(join(simulatorFolder, fileName), 'utf8').includes(forbiddenCall),
    );

    // Assert: none does, and the seeded generator is there to use instead.
    expect(filesWithMathRandom, 'no simulator file may call Math.random').toEqual([]);
    expect(fileNames, 'the seeded generator must live in this folder').toContain('seededRandom.ts');
  });
});
