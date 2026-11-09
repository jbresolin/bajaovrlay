// @vitest-environment node
/**
 * The pt-BR names of the four corners, the same in every graphic's form (packages/graphics/kit)
 *
 * What this module is for:
 *   A graphic that sits in a corner the operator picks (the channel logo, BAJAOVRLAY-63;
 *   the plain sponsor roll and the match bug after it) offers the four corners as a select
 *   in the item form, named in its manifest's `gddOptions.labels`. The kit holds those
 *   names once, `screenCornerNamesInPortuguese`, and this test holds every manifest to
 *   them, so a corner is called the same in each form and no graphic needs its own check.
 *
 * What these tests prove:
 *   - Every manifest field under packages/graphics that offers the four corners lists them
 *     in the kit's order and names each with the kit's pt-BR name.
 *   - At least the logo bug has such a field, so the walk is not passing over nothing.
 *   - A field with one corner misnamed is caught, so a pass above means something.
 *
 * What these tests deliberately do not cover:
 *   - Where each corner is on screen (screenCornerPosition.test.ts and each graphic's
 *     screenshots) and each graphic's default corner (its own manifest test).
 */
import { isDeepStrictEqual } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  listEveryGraphicManifestPath,
  readManifest,
} from './graphicManifestsOnDisk.testSupport.js';
import { screenCornerNamesInPortuguese, screenCorners } from './screenCornerPosition.js';

type ManifestField = { enum?: unknown; gddOptions?: { labels?: unknown } };

/** A corner field as the walk found it: where, the values it offers and their names. */
type CornerFieldFound = {
  where: string;
  values: unknown;
  names: unknown;
};

/** True when a field offers exactly the four corners, in any order. */
function isFieldOfTheFourCorners(field: ManifestField): boolean {
  if (!Array.isArray(field.enum) || field.enum.length !== screenCorners.length) {
    return false;
  }
  const valuesOffered: unknown[] = field.enum;
  return screenCorners.every((corner) => valuesOffered.includes(corner));
}

/** The top-level fields of a data schema that offer the four corners. */
function findCornerFieldsOfSchema(where: string, dataSchema: unknown): CornerFieldFound[] {
  const properties = (dataSchema as { properties?: Record<string, ManifestField> }).properties;
  const cornerFields: CornerFieldFound[] = [];
  for (const [fieldKey, field] of Object.entries(properties ?? {})) {
    if (isFieldOfTheFourCorners(field)) {
      cornerFields.push({
        where: `${where} → ${fieldKey}`,
        values: field.enum,
        names: field.gddOptions?.labels,
      });
    }
  }
  return cornerFields;
}

/** Every corner field of every manifest under packages/graphics. */
function findCornerFieldsOfEveryManifest(): CornerFieldFound[] {
  return listEveryGraphicManifestPath().flatMap((path) =>
    findCornerFieldsOfSchema(path, readManifest(path).schema),
  );
}

describe('the pt-BR names of the four corners', () => {
  it('are the kit’s, in the kit’s order, in every manifest field that offers the corners', () => {
    // Arrange: every corner field under packages/graphics.
    const cornerFields = findCornerFieldsOfEveryManifest();

    // Act: compare each one with the kit's corners and names.
    const fieldsUnlikeTheKit = cornerFields.filter((field) => {
      const isInTheKitsOrder = isDeepStrictEqual(field.values, [...screenCorners]);
      const hasTheKitsNames = isDeepStrictEqual(field.names, screenCornerNamesInPortuguese);
      return !isInTheKitsOrder || !hasTheKitsNames;
    });

    // Assert: at least the logo bug's field was walked, and none differs from the kit.
    expect(
      cornerFields.map((field) => field.where),
      'the logo bug’s corner field must be among those walked',
    ).toContain('logo-bug/logo-bug.ograf.json → corner');
    expect(fieldsUnlikeTheKit, 'every corner field must use the kit’s order and names').toEqual([]);
  });

  it('catches a corner field with one corner misnamed', () => {
    // Arrange: a logo field naming the bottom-right corner "Canto direito" instead.
    const dataSchemaWithAMisnamedCorner = {
      properties: {
        corner: {
          enum: [...screenCorners],
          gddOptions: {
            labels: { ...screenCornerNamesInPortuguese, 'bottom-right': 'Canto direito' },
          },
        },
      },
    };

    // Act: walk it as the test above walks the manifests.
    const cornerFields = findCornerFieldsOfSchema('logo de teste', dataSchemaWithAMisnamedCorner);

    // Assert: it is found, and its names are not the kit's.
    expect(cornerFields, 'the misnamed field must be found').toHaveLength(1);
    expect(
      cornerFields[0]?.names,
      'its names must differ from the kit’s, so the test above would fail on it',
    ).not.toEqual(screenCornerNamesInPortuguese);
  });
});
