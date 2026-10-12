// Test support: stand-ins for packages/graphics with or without a built race clock, so
// server tests never need BAJAOVRLAY-10's package to be built (or even merged).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

/**
 * The manifest the stand-in build holds: the fields the server reads, plus a few more.
 * Its data `schema` and `v_baja` say the same as the real
 * packages/graphics/race-clock/race-clock.ograf.json (six required fields, optional
 * laps, nothing else allowed; clock layer), so a take the server accepts here is one
 * the real race clock accepts too. `gddType` is kept on one field on purpose: it is an
 * OGraf form hint, not a JSON Schema keyword, and the server must not choke on it. The
 * same goes for the per-field `v_baja` hints the control page's generated form reads
 * (`unit: 'ms'` on the reference time, `role: 'wallClock'` on the reference moment):
 * the server's data check ignores them, but `role: 'wallClock'` is what lets a command
 * have the reference moment stamped. `v_baja.updateRule` names the same rule as the real
 * manifest, so an update here carries the clock forward exactly as on a race day.
 */
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
  schema: {
    type: 'object',
    properties: {
      sessionName: { type: 'string', title: 'Nome da sessão', gddType: 'single-line' },
      state: {
        type: 'string',
        title: 'Bandeira',
        enum: ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'],
      },
      clockMode: {
        type: 'string',
        title: 'Modo do relógio',
        enum: ['elapsed', 'remaining'],
        v_baja: { role: 'clockMode' },
      },
      referenceTimeMs: {
        type: 'integer',
        title: 'Tempo de referência',
        minimum: 0,
        v_baja: { unit: 'ms', role: 'clockTime' },
      },
      referenceWallClockMs: {
        type: 'integer',
        title: 'Horário da referência',
        minimum: 0,
        v_baja: { role: 'wallClock' },
      },
      running: { type: 'boolean', title: 'Relógio correndo', v_baja: { role: 'clockRunning' } },
      lapsCompletedByLeader: { type: 'integer', title: 'Voltas do líder', minimum: 0 },
    },
    required: [
      'sessionName',
      'state',
      'clockMode',
      'referenceTimeMs',
      'referenceWallClockMs',
      'running',
    ],
    additionalProperties: false,
  },
  v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockForward' },
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

/**
 * Creates a graphics folder holding one built package, `scoreboard`, with the given
 * manifest (and the race clock's source without a build). Returns the folder's path.
 * For tests about a manifest the race clock does not have: a broken schema, a wrong rule.
 */
export function createGraphicsFolderWithBuiltScoreboard(scoreboardManifest: object): string {
  const graphicsFolder = createGraphicsFolderWithUnbuiltRaceClock();
  const scoreboardDistFolder = join(graphicsFolder, 'scoreboard', 'dist');
  mkdirSync(scoreboardDistFolder, { recursive: true });
  writeFileSync(
    join(scoreboardDistFolder, 'scoreboard.ograf.json'),
    JSON.stringify(scoreboardManifest),
  );
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
