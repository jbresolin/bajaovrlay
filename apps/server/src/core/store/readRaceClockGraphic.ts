import { existsSync, readFileSync } from 'node:fs';

import { type Graphic, OGrafManifestSchema } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';

/**
 * Reads the race clock's built OGraf manifest and returns the graphic to register, or
 * undefined (after a logged warning if missing, an error if broken) when it cannot.
 */
export function readRaceClockGraphic(
  manifestPath: string,
  logger: ServerLogger,
): Graphic | undefined {
  // The race clock is another package (BAJAOVRLAY-10) that may not be built, or not
  // merged yet. Neither a missing nor a broken manifest stops the boot: the layers
  // must come up.
  if (!existsSync(manifestPath)) {
    logger.warn(
      { manifest_path: manifestPath },
      'race-clock manifest not found; booting without the race clock graphic',
    );
    return undefined;
  }

  let manifest: Graphic['manifest'];
  try {
    const manifestText = readFileSync(manifestPath, 'utf8');
    manifest = OGrafManifestSchema.parse(JSON.parse(manifestText));
  } catch (readError) {
    logger.error(
      { err: readError, manifest_path: manifestPath },
      'race-clock manifest is unreadable; booting without the race clock graphic',
    );
    return undefined;
  }

  // The id is the package folder name, because the renderer loads the graphic's files
  // from /graphics/<id>/ (the OGraf id inside the manifest is `baja-race-clock`).
  return {
    id: 'race-clock',
    manifest,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}
