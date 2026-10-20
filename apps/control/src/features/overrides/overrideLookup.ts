import type { Override, OverrideKey } from '@bajaovrlay/shared';

/** The corrections in force, by their key, built once per redraw of a page. */
export type OverrideLookup = ReadonlyMap<string, Override>;

/** "simulador-enduro|car|teamName|42": one text per key (a session key has no car). */
function writeLookupKey(key: {
  sourceId: string;
  scope: string;
  field: string;
  carNumber?: number | undefined;
}): string {
  return [key.sourceId, key.scope, key.field, key.carNumber ?? ''].join('|');
}

/**
 * One Map of the corrections in force, keyed by source, scope, field and car. The Fontes
 * tables build it once and hand each cell its own correction: a store subscription and a
 * search per cell, about 360 of them per poll for 60 cars, froze the page (gate 2, PR #18).
 */
export function buildOverrideLookup(overrides: Override[]): OverrideLookup {
  return new Map(overrides.map((override) => [writeLookupKey(override), override]));
}

/** The correction in force for this key, if any. */
export function findOverrideInLookup(
  lookup: OverrideLookup,
  key: OverrideKey,
): Override | undefined {
  return lookup.get(writeLookupKey(key));
}

/** What a Fontes table needs to make its values correctable: the source and its lookup. */
export type CorrectionsOfSource = {
  sourceId: string;
  sourceLabel: string;
  overrideLookup: OverrideLookup;
};
