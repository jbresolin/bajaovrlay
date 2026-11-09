import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  findStepCounter,
  type Graphic,
  OGrafManifestSchema,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { isDataSchemaOfGraphicUsable } from './graphicDataValidation.js';
import { decideGraphicPlacementFromManifest } from './graphicPlacement.js';
import { chooseUpdateRuleOfGraphic } from './updateRules/index.js';

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
 * package folder), in folder-name order. A folder with no manifest, at its root or in its
 * dist/, is not a graphic (the graphics kit, packages/graphics/kit) and is passed over
 * without a word. A package that is not built, or whose manifest is broken, is logged and
 * left out; it never stops the boot. Each graphic's default layer and category come from
 * its own manifest (`v_baja`); see graphicPlacement.ts.
 * A graphic whose data schema cannot be used, or whose manifest names an update rule
 * that cannot be run, a step counter the server does not know or car groups the shared
 * check refuses, is kept, with a warning naming it.
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
    if (!isAGraphicPackageFolder(join(graphicPackagesFolder, packageName))) {
      continue;
    }
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

/**
 * Whether a folder is a graphic's: one holding an OGraf manifest at its root (its source)
 * or in its dist/ (its build). The kit holds neither.
 */
function isAGraphicPackageFolder(packageFolder: string): boolean {
  const distFolder = join(packageFolder, 'dist');
  const foldersThatMayHoldAManifest = [packageFolder];
  if (existsSync(distFolder)) {
    foldersThatMayHoldAManifest.push(distFolder);
  }
  return foldersThatMayHoldAManifest.some((folder) =>
    readdirSync(folder).some((fileName) => fileName.endsWith('.ograf.json')),
  );
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
  const graphic: Graphic = {
    id: packageName,
    manifest,
    defaultLayerId: placementDecision.placement.defaultLayerId,
    category: placementDecision.placement.category,
    thumbnailUrl: null,
    defaultFields: {},
  };
  if (!isDataSchemaOfGraphicUsable(graphic)) {
    // The graphic stays registered, so the control page shows it and the refusal of its
    // takes can name it; leaving it out would make it vanish without a reason on screen.
    // Without this line the first sign of a broken schema would be a refused take on air.
    logger.warn(
      { graphic_package: packageName },
      'graphic has a data schema that cannot be used; every take of it will be refused',
    );
  }
  const updateRuleChoice = chooseUpdateRuleOfGraphic(graphic);
  if (updateRuleChoice.status === 'unusable') {
    // Same reasoning as above: the graphic stays registered and can still be taken (a
    // take runs no rule), but every update of it on air will be refused, and without
    // this line the first sign would be a refused "Atualizar" in the middle of a race.
    logger.warn(
      { graphic_package: packageName, update_rule_problem: updateRuleChoice.problem },
      'graphic names an update rule that cannot be run; every update of it will be refused',
    );
  }
  const stepCounterName = manifest.v_baja?.stepCounter;
  if (stepCounterName !== undefined && findStepCounter(stepCounterName) === undefined) {
    // An unknown counter reads as one step (graphicSteps.ts), so Camadas would never offer
    // "Próximo" for the graphic; this line is the only place that says why (BAJAOVRLAY-25).
    logger.warn(
      { graphic_package: packageName, step_counter: stepCounterName },
      'graphic names a step counter the server does not know; it will have one step',
    );
  }
  const carGroupsReading = readCarGroupsOfManifest(manifest);
  if (carGroupsReading.status === 'refused') {
    // The control page ignores refused groups and shows the car's fields one by one, so
    // the picker would just be missing; this line says why (BAJAOVRLAY-66).
    logger.warn(
      { graphic_package: packageName, car_group_problems: carGroupsReading.problems },
      'graphic declares car groups the check refuses; its fields are shown one by one',
    );
  }
  return graphic;
}
