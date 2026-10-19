// A page reloading itself when the server's build changes (gate 2 of PR #17). An open
// page only reconnects its WebSocket when the server restarts, and keeps the bundle and
// the schemas it loaded; after an upgrade it may refuse what the new server sends. The
// server names its build in `hello`, and a page loaded from another build reloads.
// Shared, so the control page and the renderer follow the very same rule; each hands in
// its browser's clock, `location.reload` and `sessionStorage`, which shared code cannot
// name (it compiles without the DOM types).
//
// At most one reload per build a server announces (gate 2 re-check, João): a page loaded
// between `pnpm build` and the restart carries the new build while the server still
// announces the old one, and a reload a minute would blank an OBS source on air each
// minute until the restart. Keeping the announced id stops that after one reload.

// The two keys below are the plain names; each app's browserPageReloadForNewBuild.ts adds
// the page's address to them (reloadMemoryOfOnePage.ts), because the control page and its
// two monitor frames share one sessionStorage and must each keep their own entries.

/** The sessionStorage key holding the server build this page last reloaded for. */
export const serverBuildLastReloadedForStorageKey = 'bajaovrlay.serverBuildIdLastReloadedFor';

/** The sessionStorage key holding when this page last reloaded, for the fallback, in ms. */
export const lastReloadForNewBuildStorageKey = 'bajaovrlay.lastReloadForNewBuildAtMs';

/** The fallback's shortest time between two reloads for a new build: one minute. */
export const shortestTimeBetweenReloadsForNewBuildInMilliseconds = 60_000;

/** The two calls of the browser's sessionStorage this needs. */
export type ReloadMemory = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** What the page brings to the comparison: its own build, and the browser's stand-ins. */
export type PageReloadForNewBuild = {
  /** The build the page was loaded from; undefined on a page that was not built (Vite dev). */
  pageBuildId: string | undefined;
  readNowMs: () => number;
  reloadPage: () => void;
  /** Returns the page's sessionStorage. It may throw (blocked site data); that is caught. */
  openReloadMemory: () => ReloadMemory;
};

/** What the comparison did, for the page's log. */
export type ReloadForNewBuildOutcome =
  | 'reloaded'
  | 'sameBuild'
  | 'noBuildToCompare'
  | 'alreadyReloadedForThisServerBuild'
  | 'reloadedLessThanAMinuteAgo'
  | 'noMemoryForReloads';

/** What the once-per-announced-build rule found; 'storageFailed' hands over to the fallback. */
type ReloadOncePerServerBuildOutcome =
  'reloaded' | 'alreadyReloadedForThisServerBuild' | 'storageFailed';

/**
 * Reloads the page when the server's build differs from the page's, at most once for each
 * build a server announces (the announced id is kept in sessionStorage, which survives the
 * reload). If that id cannot be read or written, at most once a minute instead. Nothing is
 * compared when either id is missing. Returns what it did.
 */
export function reloadThePageWhenTheServerBuildDiffers(
  serverBuildId: string | undefined,
  pageReload: PageReloadForNewBuild,
): ReloadForNewBuildOutcome {
  if (serverBuildId === undefined || pageReload.pageBuildId === undefined) {
    return 'noBuildToCompare';
  }
  if (serverBuildId === pageReload.pageBuildId) {
    return 'sameBuild';
  }

  const outcomeOncePerServerBuild = reloadOncePerAnnouncedServerBuild(serverBuildId, pageReload);
  if (outcomeOncePerServerBuild !== 'storageFailed') {
    return outcomeOncePerServerBuild;
  }
  return reloadAtMostOnceAMinute(pageReload);
}

/**
 * The main rule: reloads unless the storage already records a reload for this very server
 * build, writing the id before reloading. Says 'storageFailed' when reading or writing throws.
 */
function reloadOncePerAnnouncedServerBuild(
  serverBuildId: string,
  pageReload: PageReloadForNewBuild,
): ReloadOncePerServerBuildOutcome {
  let reloadMemory: ReloadMemory;
  let serverBuildLastReloadedFor: string | null;
  try {
    reloadMemory = pageReload.openReloadMemory();
    serverBuildLastReloadedFor = reloadMemory.getItem(serverBuildLastReloadedForStorageKey);
  } catch {
    return 'storageFailed';
  }

  if (serverBuildLastReloadedFor === serverBuildId) {
    return 'alreadyReloadedForThisServerBuild';
  }

  // Written before the reload: once the page is gone, nothing more can be written.
  try {
    reloadMemory.setItem(serverBuildLastReloadedForStorageKey, serverBuildId);
  } catch {
    return 'storageFailed';
  }
  pageReload.reloadPage();
  return 'reloaded';
}

/**
 * The fallback when the announced build cannot be kept: reloads at most once a minute, by
 * the moment of the last reload kept in sessionStorage under its own key.
 */
function reloadAtMostOnceAMinute(pageReload: PageReloadForNewBuild): ReloadForNewBuildOutcome {
  // Without a working storage the page could not tell it had just reloaded, so a server
  // whose pages were not rebuilt would reload it at every hello. Not reloading is the
  // safe side: the page goes on as before this feature, needing a reload by hand. In a
  // browser whose sessionStorage fails as a whole (the usual case), this is where the
  // fallback ends.
  let reloadMemory: ReloadMemory;
  let rememberedText: string | null;
  try {
    reloadMemory = pageReload.openReloadMemory();
    rememberedText = reloadMemory.getItem(lastReloadForNewBuildStorageKey);
  } catch {
    return 'noMemoryForReloads';
  }

  const nowMs = pageReload.readNowMs();
  const lastReloadAtMs = readRememberedMoment(rememberedText);
  if (lastReloadAtMs !== undefined) {
    // The distance either way: a moment "in the future" means the clock was set back,
    // and that reload is as recent as one just before now.
    const timeSinceLastReloadMs = Math.abs(nowMs - lastReloadAtMs);
    if (timeSinceLastReloadMs < shortestTimeBetweenReloadsForNewBuildInMilliseconds) {
      return 'reloadedLessThanAMinuteAgo';
    }
  }

  try {
    reloadMemory.setItem(lastReloadForNewBuildStorageKey, String(nowMs));
  } catch {
    return 'noMemoryForReloads';
  }
  pageReload.reloadPage();
  return 'reloaded';
}

/**
 * How long until the fallback's once-a-minute rule allows the next reload, in ms: 0 when
 * no reload is remembered or the storage cannot be read. A page whose reload the fallback
 * skipped as too recent waits this long and compares the builds once more, so a second
 * upgrade within a minute (a quick rebuild to fix a typo) is not left until the next reconnect.
 */
export function measureWaitUntilTheNextReloadForNewBuild(
  pageReload: PageReloadForNewBuild,
): number {
  let rememberedText: string | null;
  try {
    rememberedText = pageReload.openReloadMemory().getItem(lastReloadForNewBuildStorageKey);
  } catch {
    return 0;
  }
  const lastReloadAtMs = readRememberedMoment(rememberedText);
  if (lastReloadAtMs === undefined) {
    return 0;
  }
  // The same distance either way as reloadAtMostOnceAMinute uses.
  const timeSinceLastReloadMs = Math.abs(pageReload.readNowMs() - lastReloadAtMs);
  const waitMs = shortestTimeBetweenReloadsForNewBuildInMilliseconds - timeSinceLastReloadMs;
  return Math.max(waitMs, 0);
}

/** The remembered moment in ms, or undefined when none is kept or the text is no number. */
function readRememberedMoment(rememberedText: string | null): number | undefined {
  if (rememberedText === null) {
    return undefined;
  }
  const rememberedMs = Number(rememberedText);
  if (!Number.isFinite(rememberedMs)) {
    return undefined;
  }
  return rememberedMs;
}
