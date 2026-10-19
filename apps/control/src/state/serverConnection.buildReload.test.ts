/**
 * Server connection: reloading when the server's build changes (apps/control)
 *
 * What this module is for:
 *   A control tab left open across an upgrade only reconnects its WebSocket; it keeps the
 *   bundle it loaded, whose schemas may drop what the new server sends (an older page
 *   dropped every `dataSnapshot`, its tables frozen under "Em dia"). The server names its
 *   build in each hello (`buildId`); the connection compares it with the build this page
 *   came from and reloads the page when they differ, at most once a minute.
 *
 * What these tests prove (with the browser's clock, reload and sessionStorage stood in):
 *   - A hello naming another build reloads the page once, and says so in the log.
 *   - A hello naming the page's own build reloads nothing.
 *   - A hello naming no build, or a page with no build of its own (the Vite dev server),
 *     reloads nothing.
 *   - A second hello naming another build less than a minute after a reload (the page
 *     came back, and the server's pages were never rebuilt) reloads nothing and warns.
 *   - The hello is still taken in as usual: the page is connected either way.
 *   - A reload skipped that way is not lost: once the minute is over, the builds are
 *     compared again, and a page still on another build reloads then (a second upgrade
 *     40 seconds after the first, to fix a typo).
 *   - A hello this page's own schema refuses (a newer server's slices) still reloads the
 *     page when it names another build: that page is the one that most needs it.
 *
 * What these tests deliberately do not cover:
 *   - The edge cases of the one-a-minute rule and a broken storage;
 *     packages/shared/src/build/reloadForNewServerBuild.test.ts covers them.
 *   - The real location.reload and sessionStorage (browserPageReloadForNewBuild.ts), and
 *     the id Vite embeds; a page reloading itself after an upgrade is the PR walk's step.
 */
import type { PageReloadForNewBuild, ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { connectControlPageToFakeServer } from './connectionToFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

// The build this page was loaded from yesterday, and the one the server runs after the
// upgrade this morning, written as scripts/writeBuildId.js writes them.
const buildOfThisPage = '2026-10-18T09:12:44.103Z';
const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';
// A second upgrade 40 seconds later, to fix a typo found right after the first.
const buildOfTheTypoFix = '2026-10-19T07:40:42.907Z';
// 10:15 in Brasília on 19 October 2026, when the first hello arrives.
const momentOfTheFirstHelloMs = Date.parse('2026-10-19T13:15:00.000Z');

/**
 * A page loaded from `pageBuildId`, with a clock the test moves, a reload it counts and a
 * sessionStorage that outlives a reload (as the browser's does for a tab).
 */
function createPageThatCountsItsReloads(pageBuildId: string | undefined) {
  let nowMs = momentOfTheFirstHelloMs;
  let numberOfReloads = 0;
  const sessionEntries = new Map<string, string>();
  const pageReloadForNewBuild: PageReloadForNewBuild = {
    pageBuildId,
    readNowMs: () => nowMs,
    reloadPage: () => {
      numberOfReloads += 1;
    },
    openReloadMemory: () => ({
      getItem: (key) => sessionEntries.get(key) ?? null,
      setItem: (key, value) => {
        sessionEntries.set(key, value);
      },
    }),
  };
  return {
    pageReloadForNewBuild,
    letTimePass: (milliseconds: number) => {
      nowMs += milliseconds;
    },
    countReloads: () => numberOfReloads,
  };
}

/** The hello a server sends, naming `buildId` (or no build when undefined). */
function buildHelloNamingTheBuild(buildId: string | undefined): ServerMessage {
  if (buildId === undefined) {
    return { type: 'hello', slices: buildSlicesWithNothingOnAir() };
  }
  return { type: 'hello', slices: buildSlicesWithNothingOnAir(), buildId };
}

describe('the build named in hello', () => {
  it('reloads the page once when the server runs another build', () => {
    // Arrange: a page from yesterday's build, dialling the upgraded server.
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const { fakeServerSocket, recordedLogLines } = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    fakeServerSocket.acceptConnection();

    // Act: the server's hello names this morning's build.
    fakeServerSocket.sendMessage(buildHelloNamingTheBuild(buildOfTheUpgradedServer));

    // Assert: the page reloaded once, and the log says why with both builds.
    expect(page.countReloads(), 'another build must reload the page once').toBe(1);
    expect(
      recordedLogLines,
      'the log must say the page reloads for the server build, naming both builds',
    ).toContainEqual({
      level: 'info',
      message: 'reloading the page: the server runs another build',
      details: { serverBuildId: buildOfTheUpgradedServer, pageBuildId: buildOfThisPage },
    });
  });

  const scenariosThatNeverReload = [
    // The everyday case, every hello of a normal day.
    {
      name: 'reloads nothing when the server runs the build of the page',
      pageBuildId: buildOfThisPage,
      serverBuildId: buildOfThisPage,
    },
    // A server from before this feature, or one started with no build-id.json.
    {
      name: 'reloads nothing when the hello names no build',
      pageBuildId: buildOfThisPage,
      serverBuildId: undefined,
    },
    // The page from the Vite dev server embeds no build.
    {
      name: 'reloads nothing when the page has no build of its own',
      pageBuildId: undefined,
      serverBuildId: buildOfTheUpgradedServer,
    },
  ];

  it.each(scenariosThatNeverReload)('$name', ({ pageBuildId, serverBuildId }) => {
    // Arrange: a page from the row's build, dialling a server.
    const page = createPageThatCountsItsReloads(pageBuildId);
    const { fakeServerSocket, serverStateStore } = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    fakeServerSocket.acceptConnection();

    // Act: the server's hello arrives, naming the row's build.
    fakeServerSocket.sendMessage(buildHelloNamingTheBuild(serverBuildId));

    // Assert: no reload, and the hello was taken in as always.
    expect(page.countReloads(), 'the page must not reload').toBe(0);
    expect(
      serverStateStore.getState().connectionStatus,
      'the page must be connected after the hello',
    ).toBe('connected');
  });

  it('does not reload a second time within a minute, and warns instead', () => {
    // Faked timers: the page now arms a timer for the end of the minute, and a real one
    // must not outlive the test.
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    // Arrange: the page reloaded for this morning's build 20 seconds ago (the stand-in
    // storage outlives that reload), and the server's pages were never rebuilt, so the
    // page it reloaded into still carries yesterday's build.
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const firstConnection = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    firstConnection.fakeServerSocket.acceptConnection();
    firstConnection.fakeServerSocket.sendMessage(
      buildHelloNamingTheBuild(buildOfTheUpgradedServer),
    );
    page.letTimePass(20_000);
    const secondConnection = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    secondConnection.fakeServerSocket.acceptConnection();

    // Act: the hello after the reload names the server's build again.
    secondConnection.fakeServerSocket.sendMessage(
      buildHelloNamingTheBuild(buildOfTheUpgradedServer),
    );

    // Assert: still one reload in all, the page connected, and a warning in the log.
    expect(page.countReloads(), 'a second reload within a minute must not happen').toBe(1);
    expect(
      secondConnection.serverStateStore.getState().connectionStatus,
      'the page must go on with the hello it got',
    ).toBe('connected');
    expect(
      secondConnection.recordedLogLines.map((line) => line.message),
      'the log must say the page did not reload again',
    ).toContain('not reloading for the server build: the page reloaded less than a minute ago');
  });

  it('compares the builds again once the minute is over, and reloads then', () => {
    // Arrange: timers faked; the page reloaded for this morning's build 20 seconds ago,
    // and João has since rebuilt and restarted again to fix a typo, so the reloaded
    // page's hello names the typo fix, which it does not carry either.
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const firstConnection = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    firstConnection.fakeServerSocket.acceptConnection();
    firstConnection.fakeServerSocket.sendMessage(
      buildHelloNamingTheBuild(buildOfTheUpgradedServer),
    );
    page.letTimePass(20_000);
    const secondConnection = connectControlPageToFakeServer({
      pageReloadForNewBuild: page.pageReloadForNewBuild,
    });
    secondConnection.fakeServerSocket.acceptConnection();
    secondConnection.fakeServerSocket.sendMessage(buildHelloNamingTheBuild(buildOfTheTypoFix));
    const reloadsRightAfterTheSecondHello = page.countReloads();

    // Act: the rest of the minute passes, on the page's clock and on its timers.
    page.letTimePass(39_999);
    vi.advanceTimersByTime(39_999);
    const reloadsJustBeforeTheMinute = page.countReloads();
    page.letTimePass(1);
    vi.advanceTimersByTime(1);

    // Assert: no second reload inside the minute, then exactly one when it is over.
    expect(reloadsRightAfterTheSecondHello, 'no reload may happen within the minute').toBe(1);
    expect(reloadsJustBeforeTheMinute, 'no reload may happen a millisecond early').toBe(1);
    expect(page.countReloads(), 'the skipped reload must happen once the minute is over').toBe(2);
  });

  it('reloads the page when its own schema refuses a hello naming another build', () => {
    // Arrange: a page from yesterday's build, dialling a newer server whose hello carries
    // layers in a shape this page's schema refuses.
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const { fakeServerSocket, serverStateStore, recordedLogLines } = connectControlPageToFakeServer(
      { pageReloadForNewBuild: page.pageReloadForNewBuild },
    );
    fakeServerSocket.acceptConnection();
    const helloThisPageRefuses = {
      type: 'hello',
      slices: { ...buildSlicesWithNothingOnAir(), layers: 'not-a-list' },
      buildId: buildOfTheUpgradedServer,
    };

    // Act: that hello arrives.
    fakeServerSocket.sendRawText(JSON.stringify(helloThisPageRefuses));

    // Assert: the page reloaded once, though it never connected and logged the refusal.
    expect(page.countReloads(), 'a refused hello naming another build must reload').toBe(1);
    expect(
      serverStateStore.getState().connectionStatus,
      'a refused hello must not connect the page',
    ).not.toBe('connected');
    expect(
      recordedLogLines.map((line) => line.message),
      'the log must still say the message was not in the protocol',
    ).toContain('ignored a server message that is not in the protocol');
  });
});
