/**
 * No unseeded randomness in the simulator (apps/server)
 *
 * What this module is for:
 *   The simulated race must be the same race at the same moment, at every poll, after
 *   a restart and in every test. One call to Math.random anywhere in the simulator's
 *   folder would break that quietly, so this test reads every file of the folder,
 *   subfolders included.
 *
 * What these tests prove:
 *   - The search reaches a file two folders deep: a stand-in folder with Math.random
 *     hidden in a subfolder of a subfolder is caught.
 *   - No other file of adapters/simulator/ or its subfolders (code, tests, data,
 *     README) mentions Math.random.
 *   - The seeded generator, seededRandom.ts, is in the folder to use instead.
 *
 * What these tests deliberately do not cover:
 *   - Other sources of a changing answer, such as Date.now (the adapter reads time only
 *     from the poll context, which simulatorAdapter.test.ts drives with a fixed clock).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDataFolder } from '../../../../core/boot/temporaryDataFolder.testSupport.js';

const simulatorFolder = import.meta.dirname;
const forbiddenCall = 'Math.random';
// This test names the call it looks for, so it is the one file left out of the search.
const thisTestFileName = 'simulatorHasNoMathRandom.test.ts';

/**
 * Every file under `folder`, subfolders included, as paths relative to it ('a/b/c.ts').
 * Written as a plain walk, so a reader can see it goes into every subfolder.
 */
function listEveryFileUnder(folder: string): string[] {
  const filePaths: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const filesInSubfolder = listEveryFileUnder(join(folder, entry.name));
      filePaths.push(...filesInSubfolder.map((filePath) => join(entry.name, filePath)));
    } else {
      filePaths.push(entry.name);
    }
  }
  return filePaths;
}

/** The files under `folder` (relative paths) that mention Math.random, this test left out. */
function findFilesMentioningMathRandom(folder: string): string[] {
  return listEveryFileUnder(folder)
    .filter((filePath) => filePath !== thisTestFileName)
    .filter((filePath) => readFileSync(join(folder, filePath), 'utf8').includes(forbiddenCall));
}

describe('the search for Math.random', () => {
  it('finds a call hidden two subfolders deep', () => {
    // Arrange: a stand-in simulator folder with a clean file at the top and a lap-time
    // file calling Math.random in scenarios/acceleration/.
    const standInFolder = createTemporaryDataFolder();
    writeFileSync(join(standInFolder, 'simulateEnduro.ts'), 'export const seed = 2027;\n');
    const nestedFolder = join(standInFolder, 'scenarios', 'acceleration');
    mkdirSync(nestedFolder, { recursive: true });
    writeFileSync(join(nestedFolder, 'lapTimes.ts'), 'export const lapMs = Math.random();\n');

    // Act: search the stand-in folder.
    const filesWithMathRandom = findFilesMentioningMathRandom(standInFolder);

    // Assert: the nested file is found, and only it.
    expect(filesWithMathRandom, 'the search must reach files in subfolders').toEqual([
      join('scenarios', 'acceleration', 'lapTimes.ts'),
    ]);
  });
});

describe('the simulator folder', () => {
  it('never calls Math.random in any file, subfolders included', () => {
    // Arrange: the simulator folder, as it is in the repository.
    const folderToSearch = simulatorFolder;

    // Act: keep the files that mention Math.random, at any depth.
    const filesWithMathRandom = findFilesMentioningMathRandom(folderToSearch);

    // Assert: none does, and the seeded generator is there to use instead.
    expect(filesWithMathRandom, 'no simulator file may call Math.random').toEqual([]);
    expect(
      listEveryFileUnder(folderToSearch),
      'the seeded generator must live in this folder',
    ).toContain('seededRandom.ts');
  });
});
