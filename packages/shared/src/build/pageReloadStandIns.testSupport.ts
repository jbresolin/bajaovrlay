// Stand-ins for the browser's side of a page reloading for a new server build (its
// sessionStorage, clock and location.reload), shared by reloadForNewServerBuild.test.ts and
// reloadForNewServerBuild.fallback.test.ts. Each factory builds a fresh stand-in: no state
// is shared between tests.
import {
  type PageReloadForNewBuild,
  type ReloadMemory,
  serverBuildLastReloadedForStorageKey,
} from './reloadForNewServerBuild.js';

// Two builds made on race-day morning: the one the page loaded, and the upgrade.
export const buildThePageWasLoadedFrom = '2026-10-18T09:12:44.103Z';
export const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';
// A build made after the upgrade (a typo fixed), for a second restart.
export const buildOfTheTypoFix = '2026-10-19T07:52:17.340Z';
// 10:15 in Brasília on 19 October 2026, the moment the hello arrives.
export const momentTheHelloArrivesMs = Date.parse('2026-10-19T13:15:00.000Z');

/** A sessionStorage stand-in holding what it is given, readable back by the test. */
export function createReloadMemoryHolding(storedEntries: Record<string, string>) {
  const entries = new Map<string, string>(Object.entries(storedEntries));
  const memory: ReloadMemory = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
  return { memory, readEntry: (key: string) => entries.get(key) };
}

/**
 * A sessionStorage stand-in that throws on one call (reading or writing) for the key of
 * the announced build only, and keeps every other key, so the fallback can be seen at work.
 */
export function createReloadMemoryRefusingTheServerBuildKey(
  refusedCall: 'getItem' | 'setItem',
  storedEntries: Record<string, string>,
) {
  const entries = new Map<string, string>(Object.entries(storedEntries));
  const memory: ReloadMemory = {
    getItem: (key) => {
      if (refusedCall === 'getItem' && key === serverBuildLastReloadedForStorageKey) {
        throw new Error('SecurityError: access to sessionStorage is denied');
      }
      return entries.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (refusedCall === 'setItem' && key === serverBuildLastReloadedForStorageKey) {
        throw new Error('QuotaExceededError');
      }
      entries.set(key, value);
    },
  };
  return { memory, readEntry: (key: string) => entries.get(key) };
}

/**
 * The page side of the comparison for a page loaded from `pageBuildId`, with the given
 * memory and a clock the test moves (it starts when the hello arrives); it counts the
 * reloads and the memory openings.
 */
export function createPageReloadForTests(pageBuildId: string | undefined, memory: ReloadMemory) {
  let nowMs = momentTheHelloArrivesMs;
  let numberOfReloads = 0;
  let numberOfMemoryOpenings = 0;
  const pageReload: PageReloadForNewBuild = {
    pageBuildId,
    readNowMs: () => nowMs,
    reloadPage: () => {
      numberOfReloads += 1;
    },
    openReloadMemory: () => {
      numberOfMemoryOpenings += 1;
      return memory;
    },
  };
  return {
    pageReload,
    letTimePass: (milliseconds: number) => {
      nowMs += milliseconds;
    },
    countReloads: () => numberOfReloads,
    countMemoryOpenings: () => numberOfMemoryOpenings,
  };
}
