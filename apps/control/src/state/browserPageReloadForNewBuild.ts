import type { PageReloadForNewBuild } from '@bajaovrlay/shared';

/**
 * The control page's side of "reload when the server's build changes": the build this
 * bundle was made from, and the browser's clock, reload and sessionStorage. main.tsx hands
 * it to connectToServer; tests hand in stand-ins instead. The renderer has its own copy
 * (apps/renderer/src/browserPageReloadForNewBuild.ts), since the two are separate bundles.
 */
export const browserPageReloadForNewBuild: PageReloadForNewBuild = {
  pageBuildId: import.meta.env.BAJAOVRLAY_BUILD_ID,
  readNowMs: () => Date.now(),
  reloadPage: () => window.location.reload(),
  // A getter, because merely reading window.sessionStorage throws when site data is blocked.
  openReloadMemory: () => window.sessionStorage,
};
