import { keepTheReloadMemoryOfOnePageApart, type PageReloadForNewBuild } from '@bajaovrlay/shared';

/**
 * The renderer's side of "reload when the server's build changes": the build this bundle
 * was made from, and the browser's clock, reload and sessionStorage (an OBS browser
 * source has all three). renderer.ts hands it to connectToServer; tests hand in stand-ins.
 * The control page has its own copy (apps/control/src/state/browserPageReloadForNewBuild.ts).
 */
export const browserPageReloadForNewBuild: PageReloadForNewBuild = {
  pageBuildId: import.meta.env.BAJAOVRLAY_BUILD_ID,
  readNowMs: () => Date.now(),
  reloadPage: () => window.location.reload(),
  // A getter, because merely reading window.sessionStorage throws when site data is blocked.
  // Keyed by this page's address: the control page and its Programa and Prévia frames
  // share one sessionStorage, and one page's reload must not hold back the others.
  openReloadMemory: () =>
    keepTheReloadMemoryOfOnePageApart(
      window.sessionStorage,
      window.location.pathname + window.location.search,
    ),
};
