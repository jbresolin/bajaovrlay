// Test support: the graphics the trigger tests' macros take, "built" from their real
// manifests (moved out of triggersOnTheStore.testSupport.ts by BAJAOVRLAY-64, to keep that
// file under 400 lines). Each call makes a new temporary folder.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGraphicsFolderWithUnbuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';

/** The graphics whose real manifests the store registers, by package folder. */
const graphicFoldersUsed = ['lower-third', 'notice', 'countdown', 'sponsor-roll-plain'];

/** packages/graphics in this repository, where the real manifests are. */
const repositoryGraphicsFolder = fileURLToPath(
  new URL('../../../../../packages/graphics/', import.meta.url),
);

/**
 * A temporary graphics folder with the lower third, the notice, the countdown and the plain
 * sponsor roll "built": their real manifests copied into dist/, so a take here is refused or
 * accepted exactly as on race day.
 */
export function createGraphicsFolderWithTheRealGraphicsOfTheMacros(): string {
  const graphicsFolder = createGraphicsFolderWithUnbuiltRaceClock();
  for (const folderName of graphicFoldersUsed) {
    const manifestText = readFileSync(
      join(repositoryGraphicsFolder, folderName, `${folderName}.ograf.json`),
      'utf8',
    );
    const distFolder = join(graphicsFolder, folderName, 'dist');
    mkdirSync(distFolder, { recursive: true });
    writeFileSync(join(distFolder, `${folderName}.ograf.json`), manifestText);
  }
  return graphicsFolder;
}
