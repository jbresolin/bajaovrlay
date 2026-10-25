// Reading stored sponsors written before BAJAOVRLAY-46, when the top level was `master`,
// in the design's levels (`diamante`). Run at boot on the stored sponsors row, before that
// row is checked against its schema. The row itself is not written back: it is read this
// way at every boot until a sponsor command saves the slice again, which is harmless.
//
// Why at load, before the schema check: the shared SponsorTierSchema has the design's six
// levels only, so clients never see the old name and no code but this file (and the CSV's
// alias) needs to know it existed. A stored row that fails its schema stops the boot, so
// converting after the check is impossible.
//
// What could go wrong: only `master` is renamed. Any other level the schema does not know
// is left as it is, so the check refuses it and the boot stops: guessing a level would
// hide a damaged row.

/** The top level's name before the design renamed it. */
const oldNameOfTheTopLevel = 'master';

/** The top level as the design names it. */
const topLevel = 'diamante';

/**
 * Gives every stored sponsor whose `tier` is `master` the tier `diamante`. Anything else
 * (another level, a value that is not a list or not an object) is handed back as it was,
 * for the schema check to judge. Pure: the stored value is not changed.
 */
export function readStoredSponsorsInTheDesignsLevels(storedSponsors: unknown): unknown {
  if (!Array.isArray(storedSponsors)) {
    return storedSponsors;
  }
  return storedSponsors.map((storedSponsor: unknown) => readOneStoredSponsor(storedSponsor));
}

/** One stored sponsor in the design's levels, or the very same value when it needs nothing. */
function readOneStoredSponsor(storedSponsor: unknown): unknown {
  const isObject = typeof storedSponsor === 'object' && storedSponsor !== null;
  if (!isObject || !('tier' in storedSponsor)) {
    return storedSponsor;
  }
  if (storedSponsor.tier !== oldNameOfTheTopLevel) {
    return storedSponsor;
  }
  return { ...storedSponsor, tier: topLevel };
}
