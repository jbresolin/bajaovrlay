/**
 * A page reloading itself when the server's build changes: the fallback (packages/shared)
 *
 * What this module is for:
 *   A page reloads at most once for each build a server announces, keeping the announced
 *   id in sessionStorage (reloadForNewServerBuild.test.ts). When that id cannot be read
 *   or written, the page falls back to the older rule, at most one reload a minute, by
 *   the moment of the last reload kept under a key of its own. When nothing at all can
 *   be kept, it does not reload, since it could not stop a loop.
 *
 * What these tests prove:
 *   - When the announced build cannot be read, or cannot be written, the page reloads at
 *     most once a minute and remembers the moment of each reload; a moment ahead of now
 *     (the clock was set back) counts as recent, an unreadable one as none.
 *   - A page loaded between `pnpm build` and the restart, in that fallback, reloads once a
 *     minute while the server announces its old build.
 *   - A storage that cannot be used at all (blocked, private window, full) reloads nothing.
 *   - The wait until the fallback allows the next reload: what is left of the minute
 *     since the last reload, and none when no reload is remembered or the storage fails.
 *
 * What these tests deliberately do not cover:
 *   - The once-per-build rule itself; reloadForNewServerBuild.test.ts.
 *   - The timer that looks again once the minute is over; serverBuildWatch.test.ts.
 *   - A real browser sessionStorage failing as a whole fails for both keys, so in a
 *     browser the fallback mostly ends in "no reload"; the stand-ins here refuse the
 *     announced build's key only, to show the minute rule at work.
 */
import { describe, expect, it } from 'vitest';

import {
  buildOfTheUpgradedServer,
  buildThePageWasLoadedFrom,
  createPageReloadForTests,
  createReloadMemoryHolding,
  createReloadMemoryRefusingTheServerBuildKey,
  momentTheHelloArrivesMs,
} from './pageReloadStandIns.testSupport.js';
import {
  lastReloadForNewBuildStorageKey,
  measureWaitUntilTheNextReloadForNewBuild,
  type PageReloadForNewBuild,
  type ReloadMemory,
  reloadThePageWhenTheServerBuildDiffers,
} from './reloadForNewServerBuild.js';

describe('falling back to one reload a minute when the announced build cannot be kept', () => {
  const scenariosOfTheFallback = [
    // Reading the announced build throws: the fallback reloads, keeping the moment.
    {
      name: 'reloads when the announced build cannot be read and no reload is remembered',
      refusedCall: 'getItem',
      rememberedMomentText: undefined,
      expectedOutcome: 'reloaded',
    },
    // Writing the announced build throws (the storage is full): the same fallback.
    {
      name: 'reloads when the announced build cannot be written and no reload is remembered',
      refusedCall: 'setItem',
      rememberedMomentText: undefined,
      expectedOutcome: 'reloaded',
    },
    // The loop the fallback guards against: the page reloaded 20 s ago.
    {
      name: 'does not reload again 20 seconds after the last reload',
      refusedCall: 'getItem',
      rememberedMomentText: String(momentTheHelloArrivesMs - 20_000),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // Just inside the minute still waits, the write failing this time.
    {
      name: 'does not reload again 59.999 seconds after the last reload',
      refusedCall: 'setItem',
      rememberedMomentText: String(momentTheHelloArrivesMs - 59_999),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // A full minute later the page may try again (the server may have been fixed).
    {
      name: 'reloads again a full minute after the last reload',
      refusedCall: 'getItem',
      rememberedMomentText: String(momentTheHelloArrivesMs - 60_000),
      expectedOutcome: 'reloaded',
    },
    // The clock was set back since: the remembered moment is in the "future", and
    // counting from it would block reloads for an hour, or never block them at all.
    {
      name: 'counts a remembered moment 30 seconds ahead of now as recent',
      refusedCall: 'getItem',
      rememberedMomentText: String(momentTheHelloArrivesMs + 30_000),
      expectedOutcome: 'reloadedLessThanAMinuteAgo',
    },
    // Something else wrote the key: it is no moment, so it is as if none were remembered.
    {
      name: 'treats a remembered text that is no number as no reload at all',
      refusedCall: 'getItem',
      rememberedMomentText: 'ontem à tarde',
      expectedOutcome: 'reloaded',
    },
  ] as const;

  it.each(scenariosOfTheFallback)(
    '$name',
    ({ refusedCall, rememberedMomentText, expectedOutcome }) => {
      // Arrange: a page from yesterday's build whose storage refuses the announced build,
      // with the row's remembered moment of the last reload.
      const storedEntries: Record<string, string> = {};
      if (rememberedMomentText !== undefined) {
        storedEntries[lastReloadForNewBuildStorageKey] = rememberedMomentText;
      }
      const { memory, readEntry } = createReloadMemoryRefusingTheServerBuildKey(
        refusedCall,
        storedEntries,
      );
      const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

      // Act: the upgraded server's hello arrives.
      const outcome = reloadThePageWhenTheServerBuildDiffers(
        buildOfTheUpgradedServer,
        page.pageReload,
      );

      // Assert: the page reloaded only when the last reload is a minute old or unknown,
      // and a reload remembered its moment for the next minute.
      expect(outcome, 'the outcome must follow the one-reload-a-minute rule').toBe(expectedOutcome);
      const expectedNumberOfReloads = expectedOutcome === 'reloaded' ? 1 : 0;
      expect(page.countReloads(), 'the page must reload only when the minute is over').toBe(
        expectedNumberOfReloads,
      );
      if (expectedOutcome === 'reloaded') {
        expect(
          readEntry(lastReloadForNewBuildStorageKey),
          'the moment of the reload must be remembered, so the next one waits a minute',
        ).toBe(String(momentTheHelloArrivesMs));
      }
    },
  );

  it('reloads a page loaded between pnpm build and the restart once a minute when the announced build cannot be kept', () => {
    // Arrange: that page (its build newer than the server's), its storage refusing the
    // announced build but keeping the moment.
    const { memory } = createReloadMemoryRefusingTheServerBuildKey('setItem', {});
    const page = createPageReloadForTests(buildOfTheUpgradedServer, memory);

    // Act: hellos naming the old build at 0 s, 30 s and 60 s.
    const outcomes: string[] = [];
    outcomes.push(
      reloadThePageWhenTheServerBuildDiffers(buildThePageWasLoadedFrom, page.pageReload),
    );
    page.letTimePass(30_000);
    outcomes.push(
      reloadThePageWhenTheServerBuildDiffers(buildThePageWasLoadedFrom, page.pageReload),
    );
    page.letTimePass(30_000);
    outcomes.push(
      reloadThePageWhenTheServerBuildDiffers(buildThePageWasLoadedFrom, page.pageReload),
    );

    // Assert: the fallback is the older rule, a reload at most once a minute.
    expect(outcomes, 'without the announced build kept, the minute decides').toEqual([
      'reloaded',
      'reloadedLessThanAMinuteAgo',
      'reloaded',
    ]);
  });
});

describe('a storage the page cannot use at all', () => {
  const scenariosOfABrokenStorage = [
    // Blocked site data: even reaching sessionStorage throws.
    {
      name: 'reloads nothing when the storage cannot be opened',
      openReloadMemory: (): ReloadMemory => {
        throw new Error('SecurityError: access to sessionStorage is denied');
      },
    },
    // Blocked site data again, but on the first read instead of on the way in.
    {
      name: 'reloads nothing when nothing can be read from the storage',
      openReloadMemory: (): ReloadMemory => ({
        getItem: () => {
          throw new Error('SecurityError: access to sessionStorage is denied');
        },
        setItem: () => undefined,
      }),
    },
    // A full or read-only storage: reading works, writing throws for every key.
    {
      name: 'reloads nothing when nothing can be written to the storage',
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

describe('the wait until the fallback allows the next reload', () => {
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
