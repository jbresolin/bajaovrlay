/**
 * Lookups: lists joined by key (BAJAOVRLAY-53, reversing BAJAOVRLAY-40's "no joins").
 * Each poll indexes every lookup's list by its key; each entry then finds the element its
 * own key matches, by strict equality (a Map, so 13 and "13" are different keys). One level
 * only. A list with a key twice is a problem naming the key: which element is right cannot
 * be known, and guessing would put the wrong name on air.
 */
import { quoteValueForReason } from '../transforms/quoteValueForReason.js';
import type { FlexLookup } from './flexMappingListOptions.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { readValueAtPath } from './valuePath.js';

/** One lookup's list indexed by key, ready for the entries to match. */
export type IndexedLookup = { lookup: FlexLookup; elementByKey: Map<unknown, unknown> };

/** The indexed lookups of a shape, and the problems found indexing them (pt-BR details). */
export type LookupIndexing = {
  indexedLookups: IndexedLookup[];
  problems: Array<{ lookupName: string; detail: string }>;
};

/**
 * Indexes each lookup's list by key. An element whose key is missing, null or not a text,
 * number or boolean is skipped (it can match nothing); no answer, no list, or a key held
 * twice is a problem.
 */
export function indexLookups(
  lookups: FlexLookup[],
  responsesByRequestId: Readonly<Record<string, unknown>>,
): LookupIndexing {
  const lines = ptBRFlexMapping.problemLines;
  const indexedLookups: IndexedLookup[] = [];
  const problems: LookupIndexing['problems'] = [];

  for (const lookup of lookups) {
    if (!Object.hasOwn(responsesByRequestId, lookup.requestId)) {
      const detail = lines.noResponseForLookupRequest(lookup.requestId);
      problems.push({ lookupName: lookup.lookupName, detail });
      continue;
    }
    const listReading = readValueAtPath(responsesByRequestId[lookup.requestId], lookup.listPath);
    if (listReading.outcome !== 'found' || !Array.isArray(listReading.value)) {
      const detail = lines.noLookupListAtPath(lookup.listPath, lookup.requestId);
      problems.push({ lookupName: lookup.lookupName, detail });
      continue;
    }

    const listElements: unknown[] = listReading.value;
    const elementByKey = new Map<unknown, unknown>();
    const keysSeenTwice = new Set<unknown>();
    for (const element of listElements) {
      const key = readKeyAt(element, lookup.keyPath);
      if (key === undefined) {
        continue;
      }
      if (elementByKey.has(key)) {
        keysSeenTwice.add(key);
      }
      elementByKey.set(key, element);
    }
    for (const key of keysSeenTwice) {
      const detail = lines.lookupKeyTwice(quoteValueForReason(key), lookup.listPath);
      problems.push({ lookupName: lookup.lookupName, detail });
    }
    indexedLookups.push({ lookup, elementByKey });
  }
  return { indexedLookups, problems };
}

/**
 * The element each lookup matched for one entry, by lookup name; a lookup that matched
 * none is absent, so its fields are left out and an alternative can take over.
 */
export function findLookupMatchesOfEntry(
  indexedLookups: IndexedLookup[],
  element: unknown,
): Map<string, unknown> {
  const lookupMatches = new Map<string, unknown>();
  for (const { lookup, elementByKey } of indexedLookups) {
    const entryKey = readKeyAt(element, lookup.entryKeyPath);
    if (entryKey !== undefined && elementByKey.has(entryKey)) {
      lookupMatches.set(lookup.lookupName, elementByKey.get(entryKey));
    }
  }
  return lookupMatches;
}

/** A key read at a path: a text, a number or a boolean; undefined for anything else. */
function readKeyAt(element: unknown, keyPath: string): string | number | boolean | undefined {
  const keyReading = readValueAtPath(element, keyPath);
  if (keyReading.outcome !== 'found') {
    return undefined;
  }
  const key = keyReading.value;
  const isAKey = typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean';
  return isAKey ? key : undefined;
}
