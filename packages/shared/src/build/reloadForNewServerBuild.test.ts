/**
 * A page reloading itself when the server's build changes (packages/shared)
 *
 * What this module is for:
 *   An open page (an OBS browser source, a control tab) only reconnects its WebSocket
 *   when the server restarts; it keeps the bundle it loaded. After an upgrade the server's
 *   hello names its build (`buildId`), the page compares that with the build it was
 *   loaded from, and when the two differ it reloads itself, so it gets the new bundle.
 *   A remembered moment in sessionStorage keeps it to one reload a minute, so a server
 *   whose pages were not rebuilt cannot make a page reload over and over.
 *
 * What these tests prove:
 *   - A different build reloads the page and remembers the moment of that reload.
 *   - The same build, or a missing id on either side (a dev page, an older server),
 *     reloads nothing and does not even read the storage.
 *   - A second mismatch within a minute of the last reload does not reload again; one
 *     a minute or more later does.
 *   - A remembered moment later than now (the computer's clock was set back) counts as
 *     recent, and an unreadable remembered moment counts as none.
 *   - A storage that cannot be read or written (blocked, private window) reloads
 *     nothing, because without it the page could not stop a loop.
 *   - The wait until the next reload is allowed: what is left of the minute since the
 *     last reload, and none when no reload is remembered or the storage fails.
 *
 * What these tests deliberately do not cover:
 *   - The control page and the renderer calling this on their hello; each app's
 *     serverConnection tests cover that, with the browser stand-ins injected.
 *   - Where the ids come from (scripts/writeBuildId.js, the Vite configs, the server's
 *     readBuildId.ts), which have their own tests.
 */
import { describe, expect, it } from 'vitest';

import {
  lastReloadForNewBuildStorageKey,
  measureWaitUntilTheNextReloadForNewBuild,
  type PageReloadForNewBuild,
  type ReloadMemory,
  reloadThePageWhenTheServerBuildDiffers,
} from './reloadForNewServerBuild.js';

// Two builds made on race-day morning: the one the page loaded, and the upgrade.
const buildThePageWasLoadedFrom = '2026-10-18T09:12:44.103Z';
const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';
// 10:15 in Brasília on 19 October 2026, the moment the hello arrives.
const momentTheHelloArrivesMs = Date.parse('2026-10-19T13:15:00.000Z');

/** A sessionStorage stand-in holding what it is given, readable back by the test. */
function createReloadMemoryHolding(storedEntries: Record<string, string>) {
  const entries = new Map<string, string>(Object.entries(storedEntries));
  const memory: ReloadMemory = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
  return { memory, readEntry: (key: string) => entries.get(key) };
}

/**
 * The page side of the comparison for a page loaded from `pageBuildId`, at the moment the
 * hello arrives, with the given memory; it counts the reloads and the memory openings.
 */
function createPageReloadForTests(pageBuildId: string | undefined, memory: ReloadMemory) {
  let numberOfReloads = 0;
  let numberOfMemoryOpenings = 0;
  const pageReload: PageReloadForNewBuild = {
    pageBuildId,
    readNowMs: () => momentTheHelloArrivesMs,
    reloadPage: () => {
      numberOfReloads += 1;
    },
    openReloadMemory: () => {
      numberOfMemoryOpenings += 1;
      return memory;
    },
  };
  return {
    pageReload,
    countReloads: () => numberOfReloads,
    countMemoryOpenings: () => numberOfMemoryOpenings,
  };
}

describe('comparing the server build with the build of the page', () => {
  it('reloads the page and remembers the moment when the server runs another build', () => {
    // Arrange: a page loaded yesterday, which has never reloaded for a build.
    const { memory, readEntry } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

    // Act: the upgraded server's hello names this morning's build.
    const outcome = reloadThePageWhenTheServerBuildDiffers(
      buildOfTheUpgradedServer,
      page.pageReload,
    );

    // Assert: the page reloaded once, and the moment is remembered for the next hello.
    expect(outcome, 'a different build must reload the page').toBe('reloaded');
    expect(page.countReloads(), 'the page must reload exactly once').toBe(1);
    expect(
      readEntry(lastReloadForNewBuildStorageKey),
      'the moment of the reload must be remembered, so the next one waits a minute',
    ).toBe(String(momentTheHelloArrivesMs));
  });

  const scenariosThatNeverReload = [
    // The everyday case: the page and the server come from the same build.
    {
      name: 'reloads nothing when the server runs the build the page came from',
      serverBuildId: buildThePageWasLoadedFrom,
      pageBuildId: buildThePageWasLoadedFrom,
      expectedOutcome: 'sameBuild',
    },
    // A server older than this feature, or one started with no build file, names no build.
    {
      name: 'reloads nothing when the server names no build',
      serverBuildId: undefined,
      pageBuildId: buildThePageWasLoadedFrom,
      expectedOutcome: 'noBuildToCompare',
    },
    // A page from the Vite dev server (or a test) embeds no build: nothing to compare.
    {
      name: 'reloads nothing when the page was not built',
      serverBuildId: buildOfTheUpgradedServer,
      pageBuildId: undefined,
      expectedOutcome: 'noBuildToCompare',
    },
  ] as const;

  it.each(scenariosThatNeverReload)('$name', ({ serverBuildId, pageBuildId, expectedOutcome }) => {
    // Arrange: a page that has never reloaded for a build.
    const { memory } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(pageBuildId, memory);

    // Act: the server's hello arrives.
    const outcome = reloadThePageWhenTheServerBuildDiffers(serverBuildId, page.pageReload);

    // Assert: no reload, and the storage was not even opened.
    expect(outcome, 'the outcome must say why nothing happened').toBe(expectedOutcome);
    expect(page.countReloads(), 'the page must not reload').toBe(0);
    expect(page.countMemoryOpenings(), 'the storage must not be touched').toBe(0);
  });
});

describe('at most one reload a minute', () => {
  const scenariosOfTheLastReload = [
    // The loop this guards against: the page reloaded 20 s ago and still meets another build.
    {
      name: 'does not reload again 20 seconds after the last reload',
      rememberedText: String(momentTheHelloArrivesMs - 20_000),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // Just inside the minute still waits.
    {
      name: 'does not reload again 59.999 seconds after the last reload',
      rememberedText: String(momentTheHelloArrivesMs - 59_999),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // A full minute later the page may try again (the server may have been fixed).
    {
      name: 'reloads again a full minute after the last reload',
      rememberedText: String(momentTheHelloArrivesMs - 60_000),
      expectedOutcome: 'reloaded',
    },
    // The clock was set back an hour since: the remembered moment is in the "future",
    // and counting from it would block reloads for an hour, or never block them at all.
    {
      name: 'counts a remembered moment 30 seconds ahead of now as recent',
      rememberedText: String(momentTheHelloArrivesMs + 30_000),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // Something else wrote the key: it is no moment, so it is as if none were remembered.
    {
      name: 'treats a remembered text that is no number as no reload at all',
      rememberedText: 'ontem à tarde',
      expectedOutcome: 'reloaded',
    },
  ] as const;

  it.each(scenariosOfTheLastReload)('$name', ({ rememberedText, expectedOutcome }) => {
    // Arrange: a page loaded from yesterday's build, with a remembered last reload.
    const { memory } = createReloadMemoryHolding({
      [lastReloadForNewBuildStorageKey]: rememberedText,
    });
    const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

    // Act: the upgraded server's hello arrives.
    const outcome = reloadThePageWhenTheServerBuildDiffers(
      buildOfTheUpgradedServer,
      page.pageReload,
    );

    // Assert: the page reloaded only when the last reload is a minute old or unknown.
    expect(outcome, 'the outcome must follow the one-reload-a-minute rule').toBe(expectedOutcome);
    const expectedNumberOfReloads = expectedOutcome === 'reloaded' ? 1 : 0;
    expect(page.countReloads(), 'the page must reload only when the minute is over').toBe(
      expectedNumberOfReloads,
    );
  });
});

describe('a storage the page cannot use', () => {
  const scenariosOfABrokenStorage = [
    // Blocked site data: even reaching sessionStorage throws.
    {
      name: 'reloads nothing when the storage cannot be opened',
      openReloadMemory: (): ReloadMemory => {
        throw new Error('SecurityError: access to sessionStorage is denied');
      },
    },
    // A full or read-only storage: reading works, writing throws.
    {
      name: 'reloads nothing when the moment of the reload cannot be written',
      openReloadMemory: (): ReloadMemory => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    },
  ];

  it.each(scenariosOfABrokenStorage)('$name', ({ openReloadMemory }) => {
    // Arrange: a page from yesterday's build whose storage fails.
    let numberOfReloads = 0;
    const pageReload: PageReloadForNewBuild = {
      pageBuildId: buildThePageWasLoadedFrom,
      readNowMs: () => momentTheHelloArrivesMs,
      reloadPage: () => {
        numberOfReloads += 1;
      },
      openReloadMemory,
    };

    // Act: the upgraded server's hello arrives.
    const outcome = reloadThePageWhenTheServerBuildDiffers(buildOfTheUpgradedServer, pageReload);

    // Assert: no reload, because a page that cannot remember it could reload forever.
    expect(outcome, 'a storage that fails must stop the reload').toBe('noMemoryForReloads');
    expect(numberOfReloads, 'the page must not reload without a way to remember it').toBe(0);
  });
});

describe('the wait until the next reload is allowed', () => {
  const scenariosOfTheWait: Array<{
    name: string;
    storedEntries: Record<string, string>;
    expectedWaitMs: number;
  }> = [
    // The page reloaded 20 s ago: a skipped reload is tried again 40 s from now.
    {
      name: 'waits what is left of the minute after a reload 20 seconds ago',
      storedEntries: {
        [lastReloadForNewBuildStorageKey]: String(momentTheHelloArrivesMs - 20_000),
      },
      expectedWaitMs: 40_000,
    },
    // A minute or more ago: a reload is allowed now.
    {
      name: 'waits nothing after a reload 75 seconds ago',
      storedEntries: {
        [lastReloadForNewBuildStorageKey]: String(momentTheHelloArrivesMs - 75_000),
      },
      expectedWaitMs: 0,
    },
    // The clock was set back: a moment 30 s ahead counts as 30 s ago, as for the reload.
    {
      name: 'counts a remembered moment 30 seconds ahead as 30 seconds ago',
      storedEntries: {
        [lastReloadForNewBuildStorageKey]: String(momentTheHelloArrivesMs + 30_000),
      },
      expectedWaitMs: 30_000,
    },
    // A page that never reloaded for a build has nothing to wait for.
    {
      name: 'waits nothing when no reload is remembered',
      storedEntries: {},
      expectedWaitMs: 0,
    },
  ];

  it.each(scenariosOfTheWait)('$name', ({ storedEntries, expectedWaitMs }) => {
    // Arrange: a page from yesterday's build with the row's remembered reload.
    const { memory } = createReloadMemoryHolding(storedEntries);
    const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

    // Act: measure how long until a reload is allowed again.
    const waitMs = measureWaitUntilTheNextReloadForNewBuild(page.pageReload);

    // Assert: the wait is what is left of the minute, and nothing was reloaded.
    expect(waitMs, 'the wait must be what is left of the minute since the last reload').toBe(
      expectedWaitMs,
    );
    expect(page.countReloads(), 'measuring must never reload the page').toBe(0);
  });

  it('waits nothing when the storage cannot be opened', () => {
    // Arrange: a page whose sessionStorage is blocked.
    const pageReload: PageReloadForNewBuild = {
      pageBuildId: buildThePageWasLoadedFrom,
      readNowMs: () => momentTheHelloArrivesMs,
      reloadPage: () => undefined,
      openReloadMemory: () => {
        throw new Error('SecurityError: access to sessionStorage is denied');
      },
    };

    // Act: measure how long until a reload is allowed again.
    const waitMs = measureWaitUntilTheNextReloadForNewBuild(pageReload);

    // Assert: no wait; the comparison itself then refuses to reload without a storage.
    expect(waitMs, 'a storage that fails must give no wait').toBe(0);
  });
});
