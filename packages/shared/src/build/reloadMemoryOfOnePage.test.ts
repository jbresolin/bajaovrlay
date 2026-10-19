/**
 * One page's own reload memory inside a sessionStorage shared with others (packages/shared)
 *
 * What this module is for:
 *   A page remembers in sessionStorage the server build it last reloaded for, so it
 *   reloads at most once per announced build. But sessionStorage belongs to the browser
 *   tab, not to the page: the control page's "Programa" and "Prévia" monitors are frames
 *   on the control page's own address, so all three read and write the very same storage.
 *   With one shared key, the first page to reload would record the new build for all of
 *   them, and the other two would never reload after a real upgrade. Each page therefore
 *   keeps its entries under keys that carry its own address (path and query).
 *
 * What these tests prove:
 *   - The control page and its two monitor frames, sharing one storage, each reload
 *     exactly once for an upgrade, whichever of their hellos arrives first.
 *   - Each page's entry is kept under its own key, named after its address.
 *   - In the once-a-minute fallback, one page's reload does not hold back the others.
 *
 * What these tests deliberately do not cover:
 *   - The once-per-build rule and its fallback themselves; reloadForNewServerBuild.test.ts
 *     and reloadForNewServerBuild.fallback.test.ts.
 *   - The browser's real sessionStorage and location, which each app's
 *     browserPageReloadForNewBuild.ts hands in.
 */
import { describe, expect, it } from 'vitest';

import {
  buildOfTheUpgradedServer,
  buildThePageWasLoadedFrom,
  createPageReloadForTests,
  createReloadMemoryHolding,
} from './pageReloadStandIns.testSupport.js';
import {
  type ReloadMemory,
  reloadThePageWhenTheServerBuildDiffers,
  serverBuildLastReloadedForStorageKey,
} from './reloadForNewServerBuild.js';
import { keepTheReloadMemoryOfOnePageApart } from './reloadMemoryOfOnePage.js';

// The three pages of one control tab, by their address (path and query).
const addressOfTheControlPage = '/';
const addressOfTheProgramaMonitor = '/render/?monitor=1';
const addressOfThePreviaMonitor = '/render/?target=preview&monitor=1';

/** The three pages of one control tab, all loaded from yesterday's build, on one storage. */
function createTheThreePagesOfOneControlTab(sharedStorage: ReloadMemory) {
  return {
    [addressOfTheControlPage]: createPageReloadForTests(
      buildThePageWasLoadedFrom,
      keepTheReloadMemoryOfOnePageApart(sharedStorage, addressOfTheControlPage),
    ),
    [addressOfTheProgramaMonitor]: createPageReloadForTests(
      buildThePageWasLoadedFrom,
      keepTheReloadMemoryOfOnePageApart(sharedStorage, addressOfTheProgramaMonitor),
    ),
    [addressOfThePreviaMonitor]: createPageReloadForTests(
      buildThePageWasLoadedFrom,
      keepTheReloadMemoryOfOnePageApart(sharedStorage, addressOfThePreviaMonitor),
    ),
  };
}

describe('pages of one tab sharing one sessionStorage', () => {
  const scenariosOfTheOrderOfTheHellos = [
    // The case the review found: the Programa frame reconnects first and reloads.
    {
      name: 'reloads each page once when the Programa monitor hears of the upgrade first',
      orderOfTheHellos: [
        addressOfTheProgramaMonitor,
        addressOfThePreviaMonitor,
        addressOfTheControlPage,
      ],
    },
    // The Prévia frame first: the control page and the Programa frame must still reload.
    {
      name: 'reloads each page once when the Prévia monitor hears of the upgrade first',
      orderOfTheHellos: [
        addressOfThePreviaMonitor,
        addressOfTheControlPage,
        addressOfTheProgramaMonitor,
      ],
    },
    // The control page first: its two frames must not be left on the old bundle.
    {
      name: 'reloads each page once when the control page hears of the upgrade first',
      orderOfTheHellos: [
        addressOfTheControlPage,
        addressOfTheProgramaMonitor,
        addressOfThePreviaMonitor,
      ],
    },
  ] as const;

  it.each(scenariosOfTheOrderOfTheHellos)('$name', ({ orderOfTheHellos }) => {
    // Arrange: one control tab with its two monitor frames, on one shared storage.
    const { memory: sharedStorage } = createReloadMemoryHolding({});
    const pages = createTheThreePagesOfOneControlTab(sharedStorage);

    // Act: the upgraded server's hello reaches each page, in this scenario's order.
    const outcomes = orderOfTheHellos.map((address) =>
      reloadThePageWhenTheServerBuildDiffers(buildOfTheUpgradedServer, pages[address].pageReload),
    );

    // Assert: every page reloaded exactly once, none held back by another's reload.
    expect(outcomes, 'every page must reload for the upgrade').toEqual([
      'reloaded',
      'reloaded',
      'reloaded',
    ]);
    for (const address of orderOfTheHellos) {
      expect(pages[address].countReloads(), `the page on ${address} must reload once`).toBe(1);
    }
  });

  it('keeps the announced build of each page under a key named after its address', () => {
    // Arrange: one shared storage, and the Programa monitor's own memory inside it.
    const { memory: sharedStorage, readEntry } = createReloadMemoryHolding({});
    const pages = createTheThreePagesOfOneControlTab(sharedStorage);

    // Act: only the Programa monitor hears of the upgrade.
    reloadThePageWhenTheServerBuildDiffers(
      buildOfTheUpgradedServer,
      pages[addressOfTheProgramaMonitor].pageReload,
    );

    // Assert: the build is kept under the Programa monitor's key, and the plain key is untouched.
    expect(
      readEntry(`${serverBuildLastReloadedForStorageKey}:${addressOfTheProgramaMonitor}`),
      'the Programa monitor must keep its build under its own key',
    ).toBe(buildOfTheUpgradedServer);
    expect(
      readEntry(serverBuildLastReloadedForStorageKey),
      'no entry may be kept under a key every page would share',
    ).toBeUndefined();
  });

  it('reloads each page once in the once-a-minute fallback, within the same minute', () => {
    // Arrange: a shared storage that refuses to read any page's announced build (so the
    // fallback applies) but keeps the moments of the reloads.
    const { memory: storageKeepingOnlyMoments } = createReloadMemoryHolding({});
    const sharedStorage: ReloadMemory = {
      getItem: (key) => {
        if (key.startsWith(serverBuildLastReloadedForStorageKey)) {
          throw new Error('SecurityError: access to sessionStorage is denied');
        }
        return storageKeepingOnlyMoments.getItem(key);
      },
      setItem: (key, value) => storageKeepingOnlyMoments.setItem(key, value),
    };
    const pages = createTheThreePagesOfOneControlTab(sharedStorage);

    // Act: the upgraded server's hello reaches all three pages within the same second.
    const threeHellosWithinOneSecond = [
      addressOfTheProgramaMonitor,
      addressOfThePreviaMonitor,
      addressOfTheControlPage,
    ] as const;
    const outcomes = threeHellosWithinOneSecond.map((address) =>
      reloadThePageWhenTheServerBuildDiffers(buildOfTheUpgradedServer, pages[address].pageReload),
    );

    // Assert: each page's minute is its own, so all three reload.
    expect(outcomes, 'one page reloading must not start the minute of the others').toEqual([
      'reloaded',
      'reloaded',
      'reloaded',
    ]);
  });
});
