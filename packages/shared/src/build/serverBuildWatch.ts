// What a page does with each server build it hears of, shared by the control page and the
// renderer so the two follow the very same rule: compare with the page's own build
// (reloadForNewServerBuild.ts: at most one reload per announced build), log what happened,
// and, only in the fallback for a sessionStorage that cannot keep the announced build
// (at most one reload a minute), compare once more when the minute is over after a
// skipped reload. Without that second look, a second upgrade within the minute would
// leave such a page on the old bundle until its next reconnect, since a hello only comes
// with a new connection. The page hands in its timers, which shared code cannot name (it
// compiles without the DOM or Node types).
import {
  measureWaitUntilTheNextReloadForNewBuild,
  type PageReloadForNewBuild,
  reloadThePageWhenTheServerBuildDiffers,
} from './reloadForNewServerBuild.js';

/** What the watch needs from the page: the reload stand-ins, its log and its timers. */
export type ServerBuildWatchOptions = {
  pageReload: PageReloadForNewBuild;
  logBuildEvent: (
    level: 'info' | 'warn',
    message: string,
    details: Record<string, unknown>,
  ) => void;
  /** Calls `callback` once after the wait (the browser's setTimeout); returns its cancel. */
  startTimer: (callback: () => void, waitInMilliseconds: number) => CancelTimer;
};

/** Cancels a timer started by startTimer (the browser's clearTimeout on it). */
export type CancelTimer = () => void;

/** A page's watch on the server's build. */
export type ServerBuildWatch = {
  /** Compares the build a hello named with the page's, reloading when they differ. */
  compareWithTheServerBuild: (serverBuildId: string | undefined) => void;
  /** Cancels the fallback's second look, if one is waiting (the page hung up). */
  stop: () => void;
};

/**
 * Starts a page's watch on the server's build: each build heard of is compared with the
 * page's (at most one reload per announced build), and when the once-a-minute fallback
 * skipped a reload as too recent, it is retried once the minute is over, against the
 * build of the latest hello.
 */
export function startServerBuildWatch(options: ServerBuildWatchOptions): ServerBuildWatch {
  const { pageReload, logBuildEvent } = options;
  // The build of the latest hello: the second look compares this one, not an older one.
  let latestServerBuildId: string | undefined = undefined;
  // One waiting second look at most, however many hellos come within the minute: its
  // cancel while it waits, undefined otherwise.
  let cancelTheWaitingSecondLook: CancelTimer | undefined = undefined;

  function compareWithTheServerBuild(serverBuildId: string | undefined): void {
    latestServerBuildId = serverBuildId;
    const outcome = reloadThePageWhenTheServerBuildDiffers(serverBuildId, pageReload);
    const builds = { serverBuildId, pageBuildId: pageReload.pageBuildId };
    if (outcome === 'reloaded') {
      logBuildEvent('info', 'reloading the page: the server runs another build', builds);
    }
    if (outcome === 'alreadyReloadedForThisServerBuild') {
      // A page loaded between `pnpm build` and the restart lands here at every reconnect
      // until the restart: it carries the new build, the server still announces the old.
      logBuildEvent(
        'warn',
        'not reloading for the server build: the page already reloaded once for it',
        builds,
      );
    }
    if (outcome === 'reloadedLessThanAMinuteAgo') {
      logBuildEvent(
        'warn',
        'not reloading for the server build: the page reloaded less than a minute ago',
        builds,
      );
      lookAgainOnceTheMinuteIsOver();
    }
    if (outcome === 'noMemoryForReloads') {
      logBuildEvent(
        'warn',
        'not reloading for the server build: sessionStorage is unusable',
        builds,
      );
    }
  }

  function lookAgainOnceTheMinuteIsOver(): void {
    if (cancelTheWaitingSecondLook !== undefined) {
      return;
    }
    const waitInMilliseconds = measureWaitUntilTheNextReloadForNewBuild(pageReload);
    cancelTheWaitingSecondLook = options.startTimer(() => {
      cancelTheWaitingSecondLook = undefined;
      compareWithTheServerBuild(latestServerBuildId);
    }, waitInMilliseconds);
  }

  function stop(): void {
    if (cancelTheWaitingSecondLook !== undefined) {
      cancelTheWaitingSecondLook();
      cancelTheWaitingSecondLook = undefined;
    }
  }

  return { compareWithTheServerBuild, stop };
}
