// Test support: stand-ins for packages/graphics with or without a built race clock, so
// server tests never need BAJAOVRLAY-10's package to be built (or even merged).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

/** The manifest the stand-in build holds: the fields the server reads, plus a few more. */
export const raceClockManifestForTests = {
  $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json',
  id: 'baja-race-clock',
  name: 'Relógio de prova',
  description: 'Relógio da sessão com a bandeira atual.',
  version: '0.1.0',
  main: 'race-clock.js',
  supportsRealTime: true,
  supportsNonRealTime: false,
  stepCount: 1,
};

/** A graphics folder path that never exists, as on a machine with no graphics at all. */
export const missingGraphicsFolderPath = join(tmpdir(), 'bajaovrlay-graficos-inexistentes');

/**
 * Creates a temporary graphics folder (deleted after the test) holding the race clock's
 * source but no build, as on a fresh checkout before `pnpm build`. Returns its path.
 */
export function createGraphicsFolderWithUnbuiltRaceClock(): string {
  const graphicsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-graficos-'));
  onTestFinished(() => rmSync(graphicsFolder, { recursive: true, force: true }));
  mkdirSync(join(graphicsFolder, 'race-clock', 'src'), { recursive: true });
  return graphicsFolder;
}

/** Puts a built race-clock manifest into a graphics folder, as `pnpm build` would. */
export function buildRaceClockInto(graphicsFolder: string): void {
  const distFolder = join(graphicsFolder, 'race-clock', 'dist');
  mkdirSync(distFolder, { recursive: true });
  writeFileSync(
    join(distFolder, 'race-clock.ograf.json'),
    JSON.stringify(raceClockManifestForTests),
  );
}

/** Creates a temporary graphics folder with the race clock built; returns its path. */
export function createGraphicsFolderWithBuiltRaceClock(): string {
  const graphicsFolder = createGraphicsFolderWithUnbuiltRaceClock();
  buildRaceClockInto(graphicsFolder);
  return graphicsFolder;
}

/** Creates a graphics folder whose race-clock manifest is cut off half way; returns its path. */
export function createGraphicsFolderWithBrokenRaceClockManifest(): string {
  const graphicsFolder = createGraphicsFolderWithUnbuiltRaceClock();
  const distFolder = join(graphicsFolder, 'race-clock', 'dist');
  mkdirSync(distFolder, { recursive: true });
  writeFileSync(join(distFolder, 'race-clock.ograf.json'), '{ "id": "baja-race-clock", ');
  return graphicsFolder;
}
