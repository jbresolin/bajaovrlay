// @vitest-environment jsdom
/**
 * Loading a graphic's code into the page (apps/renderer)
 *
 * What this module is for:
 *   A graphic is an OGraf package the server serves at `/graphics/<id>/`. Its manifest
 *   names a JavaScript module (`main`) whose default export is a web component class.
 *   graphicLoader imports that module and registers the class as a custom element, so
 *   the renderer can create the graphic with an ordinary `document.createElement`.
 *
 * What these tests prove:
 *   - The module is imported from `/graphics/<graphic id>/<manifest main>` and its class
 *     is registered under `baja-graphic-<graphic id>`.
 *   - A graphic taken twice is imported once: the second take reuses the first import.
 *   - A failed import is not remembered: the next take tries again.
 *   - A module with no class as its default export is refused with a clear error.
 *
 * What these tests deliberately do not cover:
 *   - A real `import()` over the network; e2e/lifecycle.e2e.ts loads a real module in
 *     Chromium. Here the import is a stand-in that answers with a module object.
 *   - What happens on screen when loading fails (the layer stays empty); the same
 *     Playwright file checks that.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createGraphicLoader } from './graphicLoader.js';

/** Builds a graphic as the `graphics` slice lists it, from its id, name and main file. */
function createGraphic(graphicId: string, name: string, mainFileName: string): Graphic {
  return {
    id: graphicId,
    manifest: { id: `baja-${graphicId}`, name, main: mainFileName },
    defaultLayerId: 'fullscreen',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** Builds what importing a graphic's module gives: a web component class as `default`. */
function createGraphicModule(): { default: CustomElementConstructor } {
  return { default: class extends HTMLElement {} };
}

describe('createGraphicLoader', () => {
  it('imports the module from /graphics/<id>/<main> and registers baja-graphic-<id>', async () => {
    // Arrange: the race clock graphic, and an import stand-in that notes what was asked.
    const raceClock = createGraphic('race-clock', 'Relógio de prova', 'race-clock.js');
    const raceClockModule = createGraphicModule();
    const importedAddresses: string[] = [];
    const graphicLoader = createGraphicLoader({
      importModule: async (address) => {
        importedAddresses.push(address);
        return raceClockModule;
      },
    });

    // Act: make the graphic's element available.
    const tagName = await graphicLoader.defineGraphicElement(raceClock);

    // Assert: the right file was imported and its class is registered under the tag.
    expect(importedAddresses, 'the module must come from the package folder').toEqual([
      '/graphics/race-clock/race-clock.js',
    ]);
    expect(tagName, 'the tag must be derived from the graphic id').toBe('baja-graphic-race-clock');
    expect(
      customElements.get('baja-graphic-race-clock'),
      "the module's default export must be the registered element class",
    ).toBe(raceClockModule.default);
  });

  it('imports a graphic once, however many times it is taken', async () => {
    // Arrange: a lower third graphic and an import stand-in that counts its calls.
    const teamLowerThird = createGraphic('team-lower-third', 'Legenda de equipe', 'legenda.js');
    const teamLowerThirdModule = createGraphicModule();
    let importCount = 0;
    const graphicLoader = createGraphicLoader({
      importModule: async () => {
        importCount += 1;
        return teamLowerThirdModule;
      },
    });

    // Act: two takes of the same graphic (team 42, then team 7).
    const firstTagName = await graphicLoader.defineGraphicElement(teamLowerThird);
    const secondTagName = await graphicLoader.defineGraphicElement(teamLowerThird);

    // Assert: one import served both, and both got the same tag.
    expect(importCount, 'the second take must reuse the first import').toBe(1);
    expect(secondTagName, 'both takes must get the same tag').toBe(firstTagName);
  });

  it('tries the import again after a failed one', async () => {
    // Arrange: a sponsor roll whose file is missing at first (not built yet), then there.
    const sponsorRoll = createGraphic('sponsor-roll', 'Patrocinadores', 'sponsor-roll.js');
    const sponsorRollModule = createGraphicModule();
    let importCount = 0;
    const graphicLoader = createGraphicLoader({
      importModule: async () => {
        importCount += 1;
        if (importCount === 1) {
          throw new TypeError('Failed to fetch dynamically imported module');
        }
        return sponsorRollModule;
      },
    });

    // Act: the first take fails; the operator takes it again after the build.
    const firstTake = graphicLoader.defineGraphicElement(sponsorRoll);
    await expect(firstTake, 'a failed import must reject the first take').rejects.toThrow(
      'Failed to fetch dynamically imported module',
    );
    const tagNameOfSecondTake = await graphicLoader.defineGraphicElement(sponsorRoll);

    // Assert: the second take imported again and succeeded.
    expect(importCount, 'a failed import must not be remembered').toBe(2);
    expect(tagNameOfSecondTake, 'the second take must get the tag').toBe(
      'baja-graphic-sponsor-roll',
    );
  });

  it('refuses a module whose default export is not a class', async () => {
    // Arrange: a starting grid package whose main file exports only a settings object.
    const startingGrid = createGraphic('starting-grid', 'Grid de largada', 'starting-grid.js');
    const graphicLoader = createGraphicLoader({
      importModule: async () => ({ default: { columns: 2 } }),
    });

    // Act: try to make its element available.
    const take = graphicLoader.defineGraphicElement(startingGrid);

    // Assert: a clear error, and nothing registered under its tag.
    await expect(take, 'a module without a default class must be refused').rejects.toThrow(
      'graphic "starting-grid" has no web component class as its default export',
    );
    expect(
      customElements.get('baja-graphic-starting-grid'),
      'nothing may be registered for a refused module',
    ).toBeUndefined();
  });
});
