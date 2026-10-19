// A page reloading itself when the server's build changes (gate 2 of PR #17). An open
// page only reconnects its WebSocket when the server restarts, and keeps the bundle and
// the schemas it loaded; after an upgrade it may refuse what the new server sends. The
// server names its build in `hello`, and a page loaded from another build reloads.
// Shared, so the control page and the renderer follow the very same rule; each hands in
// its browser's clock, `location.reload` and `sessionStorage`, which shared code cannot
// name (it compiles without the DOM types).

/** The sessionStorage key holding when this tab last reloaded for a new build, in ms. */
export const lastReloadForNewBuildStorageKey = 'bajaovrlay.lastReloadForNewBuildAtMs';

/** The shortest time between two reloads for a new build: one minute. */
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
  | 'reloadedLessThanAMinuteAgo'
  | 'noMemoryForReloads';

/**
 * Reloads the page when the server's build differs from the page's, at most once a minute
 * (the moment of each reload is kept in sessionStorage, which survives the reload).
 * Nothing is compared when either id is missing. Returns what it did.
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

  // Without a working storage the page could not tell it had just reloaded, so a server
  // whose pages were not rebuilt would reload it at every hello. Not reloading is the
  // safe side: the page goes on as before this feature, needing a reload by hand.
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
