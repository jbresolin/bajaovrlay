/**
 * Where a graphic goes by default, read from its manifest (apps/server)
 *
 * What this module is for:
 *   Each graphic in the graphics slice has a default layer (the one a take uses when
 *   the operator does not choose) and a category (how the control page groups it). Both
 *   come from the package's own manifest, in BajaOvrLay's vendor field:
 *   `"v_baja": { "defaultLayerId": "clock", "category": "clock" }`. The server no longer
 *   keeps a list of its own saying which package goes where.
 *
 * What these tests prove:
 *   - A manifest that names an existing layer is placed there, with its category.
 *   - A category is optional: without one the graphic is grouped under `other`.
 *   - A manifest with no `v_baja`, with no default layer in it, or naming a layer that
 *     does not exist is placed on `fullscreen`, the top layer, and the decision says
 *     why, so the caller can log a warning.
 *
 * What these tests deliberately do not cover:
 *   - Reading manifests from disk and logging the warning;
 *     loadInitialSlicesGraphicPlacement.test.ts covers both with a real folder.
 *   - A `v_baja` of the wrong shape (a number as layer id): the shared
 *     OGrafManifestSchema refuses that manifest before this code sees it.
 */
import type { OGrafManifest } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { decideGraphicPlacementFromManifest } from './graphicPlacement.js';

const idsOfTheSeededLayers = ['bug', 'ticker', 'clock', 'tower', 'lower-third', 'fullscreen'];

const placementScenarios: Array<{
  name: string;
  manifest: OGrafManifest;
  expectedDecision: {
    placement: { defaultLayerId: string; category: string };
    reasonForUsingFullscreen: string | undefined;
  };
}> = [
  // The race clock as it ships: its manifest says clock layer, clock category.
  {
    name: 'places the race clock on the clock layer its manifest names',
    manifest: {
      id: 'baja-race-clock',
      name: 'Relógio de prova',
      main: 'race-clock.js',
      v_baja: { defaultLayerId: 'clock', category: 'clock' },
    },
    expectedDecision: {
      placement: { defaultLayerId: 'clock', category: 'clock' },
      reasonForUsingFullscreen: undefined,
    },
  },
  // The category is optional in the brief: a layer alone is a complete declaration.
  {
    name: 'groups a graphic under "other" when its manifest names a layer but no category',
    manifest: {
      id: 'baja-team-lower-third',
      name: 'Tarja de equipe',
      main: 'tarja.js',
      v_baja: { defaultLayerId: 'lower-third' },
    },
    expectedDecision: {
      placement: { defaultLayerId: 'lower-third', category: 'other' },
      reasonForUsingFullscreen: undefined,
    },
  },
  // A package copied from a plain OGraf example has no vendor field at all.
  {
    name: 'falls back to fullscreen when the manifest has no v_baja',
    manifest: { id: 'baja-scoreboard', name: 'Placar', main: 'scoreboard.js' },
    expectedDecision: {
      placement: { defaultLayerId: 'fullscreen', category: 'other' },
      reasonForUsingFullscreen: 'the manifest declares no v_baja.defaultLayerId',
    },
  },
  // Someone filled in the category and forgot the layer: the category is still used.
  {
    name: 'falls back to fullscreen but keeps the category when only the layer is missing',
    manifest: {
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      v_baja: { category: 'scoreboard' },
    },
    expectedDecision: {
      placement: { defaultLayerId: 'fullscreen', category: 'scoreboard' },
      reasonForUsingFullscreen: 'the manifest declares no v_baja.defaultLayerId',
    },
  },
  // A typo, or a layer from another event's setup: the take must still have a layer.
  {
    name: 'falls back to fullscreen when the manifest names a layer that does not exist',
    manifest: {
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      v_baja: { defaultLayerId: 'placar', category: 'scoreboard' },
    },
    expectedDecision: {
      placement: { defaultLayerId: 'fullscreen', category: 'scoreboard' },
      reasonForUsingFullscreen: 'the layer named by v_baja.defaultLayerId does not exist',
    },
  },
];

describe('decideGraphicPlacementFromManifest', () => {
  it.each(placementScenarios)('$name', ({ manifest, expectedDecision }) => {
    // Arrange: the six seeded layers and the manifest of this scenario.

    // Act: decide where the graphic goes.
    const decision = decideGraphicPlacementFromManifest(manifest, idsOfTheSeededLayers);

    // Assert: the layer, the category and the reason for a fallback (if any) are as expected.
    expect(decision, 'the placement must follow the manifest, or say why it could not').toEqual(
      expectedDecision,
    );
  });
});
