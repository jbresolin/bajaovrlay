/**
 * The renderer's connection to the server: reloading when the server's build changes
 * (apps/renderer)
 *
 * What this module is for:
 *   An OBS browser source left open across an upgrade only reconnects its WebSocket; it
 *   keeps the bundle it loaded, whose schemas may refuse what the new server sends (an
 *   older renderer refused every hello once an httpJson source existed, and drew nothing
 *   more). The server names its build in each hello (`buildId`); the connection compares
 *   it with the build this page came from and reloads the page when they differ, at most
 *   once a minute. A program monitor runs this very code, so it does the same.
 *
 * What these tests prove (with the browser's clock, reload and sessionStorage stood in):
 *   - A hello naming another build reloads the page once, and says so in the log.
 *   - A hello naming the page's own build reloads nothing.
 *   - A hello naming no build, or a page with no build of its own (the Vite dev server),
 *     reloads nothing.
 *   - A second hello naming another build less than a minute after a reload (the server's
 *     pages were never rebuilt) reloads nothing and warns.
 *   - The hello is still delivered as a full snapshot either way, so what is on air is drawn.
 *
 * What these tests deliberately do not cover:
 *   - The edge cases of the one-a-minute rule and a broken storage;
 *     packages/shared/src/build/reloadForNewServerBuild.test.ts covers them.
 *   - The real location.reload and sessionStorage (browserPageReloadForNewBuild.ts), and
 *     the id Vite embeds; a page reloading itself after an upgrade is the PR walk's step.
 */
import type { PageReloadForNewBuild } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createSlicesWithInstances,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

// The build this OBS source was loaded from yesterday, and the one the server runs after
// the upgrade this morning, written as scripts/writeBuildId.js writes them.
const buildOfThisPage = '2026-10-18T09:12:44.103Z';
const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';
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

/** The hello a server sends with nothing on air, naming `buildId` (or no build). */
function buildHelloNamingTheBuild(buildId: string | undefined) {
  if (buildId === undefined) {
    return { type: 'hello', slices: createSlicesWithInstances([]) };
  }
  return { type: 'hello', slices: createSlicesWithInstances([]), buildId };
}

/** Starts a renderer connection with the given page, and opens its first socket. */
function startRendererConnectionWithPage(pageReloadForNewBuild: PageReloadForNewBuild) {
  const connection = startConnectionForTests(undefined, pageReloadForNewBuild);
  connection.latestSocket().simulateOpen();
  return connection;
}

describe('the build named in hello', () => {
  it('reloads the page once when the server runs another build', () => {
    // Arrange: an OBS source from yesterday's build, connected to the upgraded server.
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const connection = startRendererConnectionWithPage(page.pageReloadForNewBuild);

    // Act: the server's hello names this morning's build.
    connection.latestSocket().simulateMessage(buildHelloNamingTheBuild(buildOfTheUpgradedServer));

    // Assert: the page reloaded once, and the log says why with both builds.
    expect(page.countReloads(), 'another build must reload the page once').toBe(1);
    expect(
      connection.logLinesWithDetails,
      'the log must say the page reloads for the server build, naming both builds',
    ).toContainEqual({
      level: 'info',
      message: 'reloading the page: the server runs another build',
      details: { serverBuildId: buildOfTheUpgradedServer, pageBuildId: buildOfThisPage },
    });
  });

  const scenariosThatNeverReload = [
    // The everyday case, every hello of a normal race day.
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
    // The renderer from its Vite dev server embeds no build.
    {
      name: 'reloads nothing when the page has no build of its own',
      pageBuildId: undefined,
      serverBuildId: buildOfTheUpgradedServer,
    },
  ];

  it.each(scenariosThatNeverReload)('$name', ({ pageBuildId, serverBuildId }) => {
    // Arrange: an OBS source from the row's build, connected to a server.
    const page = createPageThatCountsItsReloads(pageBuildId);
    const connection = startRendererConnectionWithPage(page.pageReloadForNewBuild);

    // Act: the server's hello arrives, naming the row's build.
    connection.latestSocket().simulateMessage(buildHelloNamingTheBuild(serverBuildId));

    // Assert: no reload, and the hello was delivered as a full snapshot as always.
    expect(page.countReloads(), 'the page must not reload').toBe(0);
    expect(
      connection.deliveries.map((delivery) => delivery.isFullSnapshot),
      'the hello must be delivered as one full snapshot',
    ).toEqual([true]);
  });

  it('does not reload a second time within a minute, and warns instead', () => {
    // Arrange: the page reloaded for this morning's build 20 seconds ago (the stand-in
    // storage outlives that reload), and the server's pages were never rebuilt, so the
    // page it reloaded into still carries yesterday's build.
    const page = createPageThatCountsItsReloads(buildOfThisPage);
    const firstConnection = startRendererConnectionWithPage(page.pageReloadForNewBuild);
    firstConnection
      .latestSocket()
      .simulateMessage(buildHelloNamingTheBuild(buildOfTheUpgradedServer));
    page.letTimePass(20_000);
    const secondConnection = startRendererConnectionWithPage(page.pageReloadForNewBuild);

    // Act: the hello after the reload names the server's build again.
    secondConnection
      .latestSocket()
      .simulateMessage(buildHelloNamingTheBuild(buildOfTheUpgradedServer));

    // Assert: still one reload in all, the stage drawn, and a warning in the log.
    expect(page.countReloads(), 'a second reload within a minute must not happen').toBe(1);
    expect(
      secondConnection.deliveries.length,
      'the hello after the reload must still be drawn',
    ).toBe(1);
    expect(
      secondConnection.readWarnings().map((line) => line.message),
      'the log must say the page did not reload again',
    ).toContain('not reloading for the server build: the page reloaded less than a minute ago');
  });
});
