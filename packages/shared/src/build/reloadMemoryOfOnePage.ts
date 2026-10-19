// One page's own reload memory inside a sessionStorage it shares with other pages.
// sessionStorage belongs to the browser tab and origin, not to the page: the control
// page frames its "Programa" and "Prévia" monitors (/render/?monitor=1 and
// /render/?target=preview&monitor=1) on its own origin, so the three share one storage.
// Under one plain key, the first of them to reload would record the new build for all
// three, and the other two would stay on the old bundle after a real upgrade. So each
// page keeps its entries under keys that carry its address (path and query).
//
// What could go wrong: a page that changed its own address without reloading would get
// a fresh memory and could reload once more for the same build. Neither app does that
// today (the control page has no client-side routing), and the cost is one reload, not a loop.
import type { ReloadMemory } from './reloadForNewServerBuild.js';

/**
 * Wraps a storage shared by several pages so that this page's entries are kept under
 * keys of its own: `<key>:<pageAddress>`, the address being the page's path and query.
 */
export function keepTheReloadMemoryOfOnePageApart(
  sharedStorage: ReloadMemory,
  pageAddress: string,
): ReloadMemory {
  function nameTheKeyOfThisPage(key: string): string {
    return `${key}:${pageAddress}`;
  }

  return {
    getItem: (key) => sharedStorage.getItem(nameTheKeyOfThisPage(key)),
    setItem: (key, value) => sharedStorage.setItem(nameTheKeyOfThisPage(key), value),
  };
}
