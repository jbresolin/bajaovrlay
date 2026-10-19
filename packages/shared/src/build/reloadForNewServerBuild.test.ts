/**
 * A page reloading itself when the server's build changes (packages/shared)
 *
 * What this module is for:
 *   An open page (an OBS browser source, a control tab) only reconnects its WebSocket
 *   when the server restarts; it keeps the bundle it loaded. After an upgrade the server's
 *   hello names its build (`buildId`), the page compares that with the build it was
 *   loaded from, and when the two differ it reloads itself, so it gets the new bundle.
 *   It reloads at most once for each build a server announces: the announced id is kept
 *   in sessionStorage, which survives the reload, so a server whose pages carry another
 *   build (a page loaded between `pnpm build` and the restart) cannot make a page reload
 *   over and over, and an OBS source does not go blank on air again and again. Only when
 *   that id cannot be kept does the older rule apply: at most one reload a minute.
 *
 * What these tests prove:
 *   - A different build reloads the page and remembers the announced build.
 *   - The same build, or a missing id on either side (a dev page, an older server),
 *     reloads nothing and does not even read the storage.
 *   - A page loaded between `pnpm build` and the restart (its build newer than the
 *     server's) reloads exactly once while the server keeps announcing its old build,
 *     however many reconnects and minutes pass; after the restart, the server announcing
 *     the page's build reloads nothing, and one announcing a still later build reloads
 *     once more.
 *   - A second upgrade seconds after the first reloads at once: there is no minute to wait.
 *
 * What these tests deliberately do not cover:
 *   - Several pages sharing one sessionStorage (the control page and its monitor
 *     frames); reloadMemoryOfOnePage.test.ts.
 *   - The control page and the renderer calling this on their hello; each app's
 *     serverConnection tests cover that, with the browser stand-ins injected.
 *   - The once-a-minute fallback for a storage that cannot keep the announced build, and a
 *     storage that cannot be used at all; reloadForNewServerBuild.fallback.test.ts.
 *   - The timer that looks again once the fallback's minute is over; serverBuildWatch.test.ts.
 *   - Where the ids come from (scripts/writeBuildId.js, the Vite configs, the server's
 *     readBuildId.ts), which have their own tests.
 */
import { describe, expect, it } from 'vitest';

import {
  buildOfTheTypoFix,
  buildOfTheUpgradedServer,
  buildThePageWasLoadedFrom,
  createPageReloadForTests,
  createReloadMemoryHolding,
} from './pageReloadStandIns.testSupport.js';
import {
  reloadThePageWhenTheServerBuildDiffers,
  serverBuildLastReloadedForStorageKey,
} from './reloadForNewServerBuild.js';

describe('comparing the server build with the build of the page', () => {
  it('reloads the page and remembers the announced build when the server runs another', () => {
    // Arrange: a page loaded yesterday, which has never reloaded for a build.
    const { memory, readEntry } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

    // Act: the upgraded server's hello names this morning's build.
    const outcome = reloadThePageWhenTheServerBuildDiffers(
      buildOfTheUpgradedServer,
      page.pageReload,
    );

    // Assert: the page reloaded once, and the announced build is remembered.
    expect(outcome, 'a different build must reload the page').toBe('reloaded');
    expect(page.countReloads(), 'the page must reload exactly once').toBe(1);
    expect(
      readEntry(serverBuildLastReloadedForStorageKey),
      'the announced build must be remembered, so it never reloads the page again',
    ).toBe(buildOfTheUpgradedServer);
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

describe('at most one reload per announced server build', () => {
  // João ran `pnpm build` but has not restarted the server yet: a page loaded now carries
  // the new build, while the server still runs and announces yesterday's.
  const buildTheServerStillRuns = buildThePageWasLoadedFrom;
  const buildOfThePageLoadedBeforeTheRestart = buildOfTheUpgradedServer;

  /** Hands the page one hello per reconnect, `minutesBetween` apart, all naming one build. */
  function sendHellosOnSeveralReconnects(
    page: ReturnType<typeof createPageReloadForTests>,
    serverBuildId: string,
    numberOfReconnects: number,
    minutesBetween: number,
  ) {
    const outcomes: string[] = [];
    for (let reconnect = 0; reconnect < numberOfReconnects; reconnect += 1) {
      outcomes.push(reloadThePageWhenTheServerBuildDiffers(serverBuildId, page.pageReload));
      page.letTimePass(minutesBetween * 60_000);
    }
    return outcomes;
  }

  it('reloads a page loaded between pnpm build and the restart only once while the server keeps announcing its old build', () => {
    // Arrange: that page, never reloaded for a build.
    const { memory } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(buildOfThePageLoadedBeforeTheRestart, memory);

    // Act: five reconnects over twenty minutes, each hello naming the old build.
    const outcomes = sendHellosOnSeveralReconnects(page, buildTheServerStillRuns, 5, 5);

    // Assert: one reload at the first hello, and none at the four after it.
    expect(page.countReloads(), 'the old build may reload the page only once').toBe(1);
    expect(outcomes, 'every later hello must find the old build already reloaded for').toEqual([
      'reloaded',
      'alreadyReloadedForThisServerBuild',
      'alreadyReloadedForThisServerBuild',
      'alreadyReloadedForThisServerBuild',
      'alreadyReloadedForThisServerBuild',
    ]);
  });

  it("after the restart, reloads once more only if the server announces a build other than the page's: the page's own build reloads nothing", () => {
    // Arrange: that page, reloaded once for the old build and reconnected since.
    const { memory } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(buildOfThePageLoadedBeforeTheRestart, memory);
    sendHellosOnSeveralReconnects(page, buildTheServerStillRuns, 3, 5);

    // Act: João restarts the server, whose hello now names the new build.
    const outcome = reloadThePageWhenTheServerBuildDiffers(
      buildOfThePageLoadedBeforeTheRestart,
      page.pageReload,
    );

    // Assert: the two builds match, so the single reload is still the only one. "Once
    // more after the restart" (João's ruling) is read as "at most once more": the page
    // already holds the bundle the restarted server runs, so a reload would only blank it.
    // The next test shows the one more reload, for a build the page does not carry.
    expect(outcome, 'the restarted server runs the build of the page').toBe('sameBuild');
    expect(page.countReloads(), 'no reload may follow the restart').toBe(1);
  });

  it("after the restart, reloads once more when the server announces a still later build than the page's", () => {
    // Arrange: that page, reloaded once for the old build and reconnected since.
    const { memory, readEntry } = createReloadMemoryHolding({});
    const page = createPageReloadForTests(buildOfThePageLoadedBeforeTheRestart, memory);
    sendHellosOnSeveralReconnects(page, buildTheServerStillRuns, 3, 5);

    // Act: João rebuilt once more (a typo fix) before restarting, so the restarted
    // server names a build the page does not carry, on two reconnects.
    const outcomes = sendHellosOnSeveralReconnects(page, buildOfTheTypoFix, 2, 5);

    // Assert: one more reload, for the new announcement only, and that build remembered.
    expect(outcomes, 'the later build reloads once, then is known').toEqual([
      'reloaded',
      'alreadyReloadedForThisServerBuild',
    ]);
    expect(page.countReloads(), 'a newly announced build must reload once more').toBe(2);
    expect(
      readEntry(serverBuildLastReloadedForStorageKey),
      'the latest announced build must be the one remembered',
    ).toBe(buildOfTheTypoFix);
  });

  it('reloads at once for a second upgrade seconds after the first', () => {
    // Arrange: a page that reloaded 20 seconds ago for this morning's upgrade.
    const { memory } = createReloadMemoryHolding({
      [serverBuildLastReloadedForStorageKey]: buildOfTheUpgradedServer,
    });
    const page = createPageReloadForTests(buildThePageWasLoadedFrom, memory);

    // Act: the server was rebuilt and restarted again, its hello naming the typo fix.
    const outcome = reloadThePageWhenTheServerBuildDiffers(buildOfTheTypoFix, page.pageReload);

    // Assert: no minute to wait, since this build has never reloaded the page.
    expect(outcome, 'a build never reloaded for must reload at once').toBe('reloaded');
    expect(page.countReloads(), 'the page must reload exactly once').toBe(1);
  });
});
