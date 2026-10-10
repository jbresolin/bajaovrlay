import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Graphic, OGrafManifestSchema } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { decideGraphicPlacementFromManifest } from './graphicPlacement.js';

/** What discoverBuiltGraphics needs: the folder to read, the layers that exist, a logger. */
export type DiscoverBuiltGraphicsOptions = {
  /** Absolute path of packages/graphics. */
  graphicPackagesFolder: string;
  /** The ids of the layers in the layers slice; a manifest's default layer must be one. */
  existingLayerIds: string[];
  logger: ServerLogger;
};

/**
 * Lists every built graphic under `graphicPackagesFolder` (one `dist/*.ograf.json` per
 * package folder), in folder-name order. A package that is not built, or whose manifest
 * is broken, is logged and left out; it never stops the boot. Each graphic's default
 * layer and category come from its own manifest (`v_baja`); see graphicPlacement.ts.
 */
export function discoverBuiltGraphics(options: DiscoverBuiltGraphicsOptions): Graphic[] {
  const { graphicPackagesFolder, logger } = options;
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
    const graphic = readBuiltGraphic({
      packageFolder: join(graphicPackagesFolder, packageName),
      packageName,
      existingLayerIds: options.existingLayerIds,
      logger,
    });
    if (graphic !== undefined) {
      graphics.push(graphic);
    }
  }
  return graphics;
}

/** Reads one package's built manifest; undefined (after a log line) when it cannot. */
function readBuiltGraphic(options: {
  packageFolder: string;
  packageName: string;
  existingLayerIds: string[];
  logger: ServerLogger;
}): Graphic | undefined {
  const { packageFolder, packageName, logger } = options;
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
  const placementDecision = decideGraphicPlacementFromManifest(manifest, options.existingLayerIds);
  if (placementDecision.reasonForUsingFullscreen !== undefined) {
    // Not an error: the graphic can still be taken, on any layer the operator chooses.
    logger.warn(
      {
        graphic_package: packageName,
        declared_default_layer_id: manifest.v_baja?.defaultLayerId,
        reason: placementDecision.reasonForUsingFullscreen,
      },
      'graphic has no usable default layer in its manifest; using fullscreen',
    );
  }
  return {
    id: packageName,
    manifest,
    defaultLayerId: placementDecision.placement.defaultLayerId,
    category: placementDecision.placement.category,
    thumbnailUrl: null,
    defaultFields: {},
  };
}
