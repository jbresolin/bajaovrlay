/**
 * The default layer of each graphic in the graphics slice, at boot (apps/server)
 *
 * What this module is for:
 *   The graphics slice tells the control page, for each built package, which layer a
 *   take uses by default and how to group it. The server reads both from the package's
 *   own manifest, in the vendor field `v_baja`, when it builds the slice at boot. It
 *   keeps no list of its own: the old rule "race-clock goes on the clock layer" that
 *   was written into the server is gone, and the race clock's manifest now says it.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - The race clock is registered on the layer and in the category its manifest's
 *     `v_baja` names.
 *   - A package whose manifest has no `v_baja` goes to the fullscreen layer, and a
 *     warning in the log names the package and the reason.
 *   - A package whose manifest names a layer that does not exist goes to fullscreen
 *     too, keeps its category, and the warning names the layer it asked for.
 *
 * What these tests deliberately do not cover:
 *   - Every combination of layer and category; graphicPlacement.test.ts lists them
 *     against the pure decision.
 *   - A `v_baja` of the wrong shape, which makes the whole manifest unreadable;
 *     loadInitialSlices.test.ts covers unreadable manifests.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithUnbuiltRaceClock,
} from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheFullscreenWarning =
  'graphic has no usable default layer in its manifest; using fullscreen';

/**
 * Creates a graphics folder holding one built package, `scoreboard`, with the given
 * manifest (and the race clock's source without a build). Returns the folder's path.
 */
function createGraphicsFolderWithBuiltScoreboard(scoreboardManifest: object): string {
  const graphicPackagesFolder = createGraphicsFolderWithUnbuiltRaceClock();
  const scoreboardDistFolder = join(graphicPackagesFolder, 'scoreboard', 'dist');
  mkdirSync(scoreboardDistFolder, { recursive: true });
  writeFileSync(
    join(scoreboardDistFolder, 'scoreboard.ograf.json'),
    JSON.stringify(scoreboardManifest),
  );
  return graphicPackagesFolder;
}

/** Boots the slices on a brand-new database, with a logger whose lines can be read. */
function loadSlicesOnFirstBoot(graphicPackagesFolder: string) {
  const { logger, readRecordedLines } = createRecordingLogger();
  const slices = loadInitialSlices({
    database: openTemporaryDatabase().database,
    graphicPackagesFolder,
    logger,
    readCurrentTime: () => new Date('2026-10-09T08:00:00.000Z'),
  });
  return { slices, readRecordedLines };
}

describe('the default layer of a graphic whose manifest names one', () => {
  it('is the clock layer for the race clock, with the clock category, and no warning', () => {
    // Arrange: a graphics folder with the race clock built; its manifest carries
    // "v_baja": { "defaultLayerId": "clock", "category": "clock" }.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();

    // Act: load the slices, as the first boot does.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: the layer and category are the manifest's, and nothing was warned about.
    expect(
      slices.graphics.map((graphic) => [graphic.id, graphic.defaultLayerId, graphic.category]),
      'the race clock must be placed where its own manifest says',
    ).toEqual([['race-clock', 'clock', 'clock']]);
    expect(
      readRecordedLines().filter((line) => line.message === messageOfTheFullscreenWarning),
      'a manifest that names an existing layer must not cause a warning',
    ).toEqual([]);
  });
});

describe('the default layer of a graphic whose manifest names none that can be used', () => {
  it('is fullscreen, with a warning, when the manifest has no v_baja', () => {
    // Arrange: a built scoreboard whose manifest has no v_baja field, as when someone
    // starts a new graphic from a plain OGraf example.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
    });

    // Act: load the slices.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: it is registered on the top layer, where it cannot replace anything else,
    // and a warning names the package and the reason.
    expect(slices.graphics, 'an unplaced package must default to the fullscreen layer').toEqual([
      {
        id: 'scoreboard',
        manifest: { id: 'baja-scoreboard', name: 'Placar', main: 'scoreboard.js' },
        defaultLayerId: 'fullscreen',
        category: 'other',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ]);
    expect(readRecordedLines(), 'a warning must say why fullscreen was used').toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: messageOfTheFullscreenWarning,
        graphic_package: 'scoreboard',
        reason: 'the manifest declares no v_baja.defaultLayerId',
      }),
    );
  });

  it('is fullscreen, with a warning, when the manifest names a layer that does not exist', () => {
    // Arrange: a built scoreboard whose manifest asks for a layer called "placar",
    // which is not one of the five seeded layers.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      v_baja: { defaultLayerId: 'placar', category: 'scoreboard' },
    });

    // Act: load the slices.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: fullscreen instead of the missing layer, the category kept, and a warning
    // naming the layer the manifest asked for.
    expect(
      slices.graphics.map((graphic) => [graphic.id, graphic.defaultLayerId, graphic.category]),
      'a layer that does not exist must be replaced by fullscreen; the category stays',
    ).toEqual([['scoreboard', 'fullscreen', 'scoreboard']]);
    expect(readRecordedLines(), 'a warning must name the missing layer').toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: messageOfTheFullscreenWarning,
        graphic_package: 'scoreboard',
        declared_default_layer_id: 'placar',
        reason: 'the layer named by v_baja.defaultLayerId does not exist',
      }),
    );
  });
});
