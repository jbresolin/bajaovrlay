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
 *   - A graphic taken twice at the same moment is imported once: both takes share the
 *     one import.
 *   - After a failed import, the next take imports `…/<main>?retry=1`, the one after
 *     that `?retry=2`, and each retry is logged; so "rebuild the package, take again"
 *     works without reloading the page. Once an import works, it is not repeated.
 *   - Two takes that shared one failed import count as one failure, not two.
 *   - A module with no class as its default export is refused with a clear error.
 *
 * What these tests deliberately do not cover:
 *   - A real `import()` over the network; e2e/lifecycle.e2e.ts loads a real module in
 *     Chromium, and e2e/retryAfterFailedImport.e2e.ts proves there that Chromium really
 *     asks the server again for the `?retry=` address. Here the import is a stand-in.
 *   - Why the address changes at all: Chromium remembers a failed module address for the
 *     life of the page (measured with the pinned Playwright Chromium), so a second
 *     `import()` of the very same address fails without asking the server again.
 *   - What happens on screen when loading fails (the layer stays empty);
 *     e2e/brokenGraphic.e2e.ts checks that.
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

    // Act: two takes of the same graphic at the same moment, as a macro does (team 42
    // and team 7); neither waits for the other before asking.
    const firstTake = graphicLoader.defineGraphicElement(teamLowerThird);
    const secondTake = graphicLoader.defineGraphicElement(teamLowerThird);
    const firstTagName = await firstTake;
    const secondTagName = await secondTake;

    // Assert: one import served both, and both got the same tag.
    expect(importCount, 'the second take must share the import the first one started').toBe(1);
    expect(secondTagName, 'both takes must get the same tag').toBe(firstTagName);
  });

  it('imports …?retry=1, then …?retry=2, on the takes after a failed import, and logs each retry', async () => {
    // Arrange: a sponsor roll whose file is missing for the first two takes (the package
    // is not built yet) and is there for the third. The import stand-in notes every
    // address it is asked for, and the log is kept in a list.
    const sponsorRoll = createGraphic('sponsor-roll', 'Patrocinadores', 'sponsor-roll.js');
    const sponsorRollModule = createGraphicModule();
    const importedAddresses: string[] = [];
    const logLines: Array<{ level: string; message: string; details: unknown }> = [];
    const graphicLoader = createGraphicLoader({
      importModule: async (address) => {
        importedAddresses.push(address);
        if (importedAddresses.length <= 2) {
          throw new TypeError('Failed to fetch dynamically imported module');
        }
        return sponsorRollModule;
      },
      logEvent: (level, message, details) => {
        logLines.push({ level, message, details });
      },
    });

    // Act: the operator takes the sponsor roll three times, building the package before
    // the third; then a fourth time, with the graphic already working.
    const outcomeOfFirstTake = await graphicLoader
      .defineGraphicElement(sponsorRoll)
      .catch((error: unknown) => error);
    const outcomeOfSecondTake = await graphicLoader
      .defineGraphicElement(sponsorRoll)
      .catch((error: unknown) => error);
    const tagNameOfThirdTake = await graphicLoader.defineGraphicElement(sponsorRoll);
    const tagNameOfFourthTake = await graphicLoader.defineGraphicElement(sponsorRoll);

    // Assert: each take after a failure asked for a new address with the next retry
    // number, the third take worked, the fourth did not import again, and both retries
    // are in the log with the graphic, the number and the address.
    expect(
      [String(outcomeOfFirstTake), String(outcomeOfSecondTake)],
      'the first two takes must fail with the error of the import',
    ).toEqual([
      'TypeError: Failed to fetch dynamically imported module',
      'TypeError: Failed to fetch dynamically imported module',
    ]);
    expect(
      importedAddresses,
      'every take after a failed import must ask for the next ?retry= address, and a working graphic must not be imported again',
    ).toEqual([
      '/graphics/sponsor-roll/sponsor-roll.js',
      '/graphics/sponsor-roll/sponsor-roll.js?retry=1',
      '/graphics/sponsor-roll/sponsor-roll.js?retry=2',
    ]);
    expect(
      [tagNameOfThirdTake, tagNameOfFourthTake],
      'the take after the build, and the one after it, must both get the tag of the graphic',
    ).toEqual(['baja-graphic-sponsor-roll', 'baja-graphic-sponsor-roll']);
    expect(
      logLines,
      'each retry must be logged with the graphic, its number and its address',
    ).toEqual([
      {
        level: 'info',
        message: 'graphic module import retried after an earlier failure',
        details: {
          graphicId: 'sponsor-roll',
          retryNumber: 1,
          moduleAddress: '/graphics/sponsor-roll/sponsor-roll.js?retry=1',
        },
      },
      {
        level: 'info',
        message: 'graphic module import retried after an earlier failure',
        details: {
          graphicId: 'sponsor-roll',
          retryNumber: 2,
          moduleAddress: '/graphics/sponsor-roll/sponsor-roll.js?retry=2',
        },
      },
    ]);
  });

  it('counts two takes that shared one failed import as one failure', async () => {
    // Arrange: a podium graphic whose file is missing at first, and an import stand-in
    // that notes every address it is asked for.
    const podium = createGraphic('podium', 'Pódio', 'podium.js');
    const podiumModule = createGraphicModule();
    const importedAddresses: string[] = [];
    const graphicLoader = createGraphicLoader({
      importModule: async (address) => {
        importedAddresses.push(address);
        if (importedAddresses.length === 1) {
          throw new TypeError('Failed to fetch dynamically imported module');
        }
        return podiumModule;
      },
      logEvent: () => undefined,
    });

    // Act: a macro takes the podium on two layers at the same moment and both fail on
    // the one shared import; after the build the operator takes it again.
    const firstTake = graphicLoader.defineGraphicElement(podium).catch((error: unknown) => error);
    const secondTake = graphicLoader.defineGraphicElement(podium).catch((error: unknown) => error);
    await firstTake;
    await secondTake;
    await graphicLoader.defineGraphicElement(podium);

    // Assert: one import served the two failed takes, and the retry is number 1, not 2.
    expect(
      importedAddresses,
      'one failed import is one failure, however many takes were waiting for it',
    ).toEqual(['/graphics/podium/podium.js', '/graphics/podium/podium.js?retry=1']);
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
