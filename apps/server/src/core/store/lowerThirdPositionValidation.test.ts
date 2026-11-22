/**
 * The server's data check with the lower third's "Posição" (apps/server, BAJAOVRLAY-85)
 *
 * What this module is for:
 *   Before a take or an update reaches the air, the server checks the data against the
 *   graphic's manifest schema (graphicDataValidation.ts). BAJAOVRLAY-85 gave the lower
 *   third ("Tarja") an optional place along the bottom of the stage, "position": left
 *   (Esquerda), center (Centro) or right (Direita). These tests run the real manifest, as
 *   the package ships it, through that check.
 *
 * What these tests prove:
 *   - An item saved before BAJAOVRLAY-85 (a name, a role, a team line, no position)
 *     still passes, and so does a name alone.
 *   - Each of the three positions passes.
 *   - A position the lower third does not know is refused, naming the field.
 *
 * What these tests deliberately do not cover:
 *   - The lower third drawing the place; packages/graphics/lower-third.
 *   - The item editor's dropdown; apps/control's lowerThirdItemForm.test.ts.
 */
import { readFileSync } from 'node:fs';

import type { Graphic, OGrafManifest } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findProblemInGraphicData } from './graphicDataValidation.js';

/** Builds the lower third as the graphics slice holds it, from its real manifest. */
function buildLowerThirdGraphicFromItsPackage(): Graphic {
  const manifestAddress = new URL(
    '../../../../../packages/graphics/lower-third/lower-third.ograf.json',
    import.meta.url,
  );
  return {
    id: 'lower-third',
    manifest: JSON.parse(readFileSync(manifestAddress, 'utf8')) as OGrafManifest,
    defaultLayerId: 'lower-third',
    category: 'lowerThird',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The data an item saved before "Posição" existed sends: the captain of Baja UFMG. */
function createCaptainDataSavedBeforeThePosition(): Record<string, unknown> {
  return { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' };
}

describe('the lower third’s data with and without "Posição"', () => {
  it('accepts an item saved before the position existed', () => {
    // Arrange: the lower third from its real manifest, and data with no position.
    const graphic = buildLowerThirdGraphicFromItsPackage();
    const data = createCaptainDataSavedBeforeThePosition();

    // Act: check it as a take would.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: no problem; the items of before keep working, on the left as always.
    expect(problem, 'an item without a position must still pass').toBeUndefined();
  });

  it('accepts a name alone, the smallest item there is', () => {
    // Arrange: the lower third, and a guest typed by hand with nothing but a name.
    const graphic = buildLowerThirdGraphicFromItsPackage();
    const data = { name: 'Ana Paula Ribeiro' };

    // Act: check it as a take would.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: the position is optional, so nothing is missing.
    expect(problem, 'a name alone must pass').toBeUndefined();
  });

  const acceptedPositionScenarios = [
    // Esquerda chosen on purpose: the default, now also written in the item.
    { name: 'accepts the position "left" (Esquerda)', position: 'left' },
    // Centro: both pills centred on x 960.
    { name: 'accepts the position "center" (Centro)', position: 'center' },
    // Direita: the mirror of the left, at x 1824.
    { name: 'accepts the position "right" (Direita)', position: 'right' },
  ];

  it.each(acceptedPositionScenarios)('$name', ({ position }) => {
    // Arrange: the captain's data with this position.
    const graphic = buildLowerThirdGraphicFromItsPackage();
    const data = { ...createCaptainDataSavedBeforeThePosition(), position };

    // Act: check it as a take would.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: each of the three places passes.
    expect(problem, `the position "${position}" must pass`).toBeUndefined();
  });

  it('refuses a position the lower third does not know, naming the field', () => {
    // Arrange: the captain's data with the place written in Portuguese by a hand-written request.
    const graphic = buildLowerThirdGraphicFromItsPackage();
    const data = { ...createCaptainDataSavedBeforeThePosition(), position: 'direita' };

    // Act: check it.
    const problem = findProblemInGraphicData(graphic, data);

    // Assert: refused, and the field is named.
    expect(problem, 'an unknown position must be refused').toEqual({
      kind: 'invalidValue',
      fieldPath: 'position',
    });
  });
});
