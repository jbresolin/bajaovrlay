// Test support: a stand-in for the race clock's built OGraf manifest, so server tests
// never need BAJAOVRLAY-10's package to be built (or even merged).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

/** The manifest the stand-in file holds: the fields the server reads, plus a few more. */
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

/** A manifest path that never exists, standing in for "BAJAOVRLAY-10 is not built". */
export const missingRaceClockManifestPath = join(
  tmpdir(),
  'bajaovrlay-relogio-nunca-compilado',
  'race-clock.ograf.json',
);

/** Writes the stand-in manifest to a temporary folder (deleted after the test); returns its path. */
export function writeTemporaryRaceClockManifest(): string {
  const temporaryFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-relogio-'));
  onTestFinished(() => rmSync(temporaryFolder, { recursive: true, force: true }));
  const manifestPath = join(temporaryFolder, 'race-clock.ograf.json');
  writeFileSync(manifestPath, JSON.stringify(raceClockManifestForTests));
  return manifestPath;
}
