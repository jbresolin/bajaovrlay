import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Graphic, OGrafManifestSchema } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';

/** Where a known package's takes go by default, and how the control page groups it. */
type GraphicPlacement = Pick<Graphic, 'defaultLayerId' | 'category'>;

const knownGraphicPlacements: Record<string, GraphicPlacement> = {
  'race-clock': { defaultLayerId: 'clock', category: 'clock' },
};

// A package nobody has placed yet goes to the top layer by default: there it can never
// replace the logo, the clock or a lower third that is on air.
const placementOfUnplacedGraphics: GraphicPlacement = {
  defaultLayerId: 'fullscreen',
  category: 'other',
};

/**
 * Lists every built graphic under `graphicPackagesFolder` (one `dist/*.ograf.json` per
 * package folder), in folder-name order. A package that is not built, or whose manifest
 * is broken, is logged and left out; it never stops the boot.
 */
export function discoverBuiltGraphics(
  graphicPackagesFolder: string,
  logger: ServerLogger,
): Graphic[] {
  if (!existsSync(graphicPackagesFolder)) {
    logger.warn(
      { graphics_folder: graphicPackagesFolder },
      'graphics folder not found; booting without graphics',
    );
    return [];
  }

  const packageNames = readdirSync(graphicPackagesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const graphics: Graphic[] = [];
  for (const packageName of packageNames) {
    const graphic = readBuiltGraphic(join(graphicPackagesFolder, packageName), packageName, logger);
    if (graphic !== undefined) {
      graphics.push(graphic);
    }
  }
  return graphics;
}

/** Reads one package's built manifest; undefined (after a log line) when it cannot. */
function readBuiltGraphic(
  packageFolder: string,
  packageName: string,
  logger: ServerLogger,
): Graphic | undefined {
  const distFolder = join(packageFolder, 'dist');
  const manifestFileNames = existsSync(distFolder)
    ? readdirSync(distFolder).filter((fileName) => fileName.endsWith('.ograf.json'))
    : [];
  if (manifestFileNames.length > 1) {
    logger.error(
      { graphic_package: packageName, manifests: manifestFileNames },
      'graphic package has more than one manifest; skipping it',
    );
    return undefined;
  }
  const manifestFileName = manifestFileNames[0];
  if (manifestFileName === undefined) {
    logger.warn({ graphic_package: packageName }, 'graphic package is not built; skipping it');
    return undefined;
  }

  const manifestPath = join(distFolder, manifestFileName);
  let manifest: Graphic['manifest'];
  try {
    manifest = OGrafManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  } catch (readError) {
    logger.error(
      { err: readError, manifest_path: manifestPath },
      'graphic manifest is unreadable; skipping it',
    );
    return undefined;
  }

  // The id is the package folder name, because the renderer loads the graphic's files
  // from /graphics/<id>/ (the race clock's OGraf id inside its manifest is different).
  const placement = knownGraphicPlacements[packageName] ?? placementOfUnplacedGraphics;
  return {
    id: packageName,
    manifest,
    ...placement,
    thumbnailUrl: null,
    defaultFields: {},
  };
}
