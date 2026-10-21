import type { PositionEntry } from '../dataShapes/positionsShape.js';
import type { StandingsEntry } from '../dataShapes/standingsShape.js';
import type { DataSnapshotShapes } from '../dataSources/dataSnapshot.js';
import type { Override } from './override.js';

/**
 * Lays one source's overrides over its shapes and gives new shapes; the shapes given are
 * never changed in place, and a shape no override touched comes back as the very same
 * object. A session override replaces its field; a car override replaces its field in
 * every entry of that car, in the positions and in the standings, when that list has the
 * field (status in the positions only). Overrides of other sources
 * are skipped, and one naming a car the snapshot does not list changes nothing.
 * Deliberate: the shape rules are not checked again. A correction is the operator's word
 * and is shown as it is; the fields that could break an order (laps, gaps, ranks) are
 * not correctable (override.ts).
 */
export function applyOverridesToSnapshotShapes(
  sourceId: string,
  shapes: DataSnapshotShapes,
  overrides: Override[],
): DataSnapshotShapes {
  const overridesOfThisSource = overrides.filter((override) => override.sourceId === sourceId);
  if (overridesOfThisSource.length === 0) {
    return shapes;
  }
  const correctedShapes: DataSnapshotShapes = { ...shapes };

  const sessionOverrides = overridesOfThisSource.filter((override) => override.scope === 'session');
  if (shapes.session !== undefined && sessionOverrides.length > 0) {
    const correctedSession: Record<string, unknown> = { ...shapes.session };
    for (const override of sessionOverrides) {
      correctedSession[override.field] = override.value;
    }
    correctedShapes.session = correctedSession as typeof shapes.session;
  }

  const carOverrides = overridesOfThisSource.filter((override) => override.scope === 'car');
  if (shapes.positions !== undefined && carOverrides.length > 0) {
    correctedShapes.positions = {
      ...shapes.positions,
      entries: shapes.positions.entries.map((entry) =>
        applyCarOverridesToEntry(entry, carOverrides),
      ),
    };
  }
  if (shapes.standings !== undefined && carOverrides.length > 0) {
    correctedShapes.standings = {
      ...shapes.standings,
      entries: shapes.standings.entries.map((entry) =>
        applyCarOverridesToEntry(entry, carOverrides),
      ),
    };
  }
  return correctedShapes;
}

/**
 * One entry with the overrides of its car laid over the fields it has. A field the entry's
 * list does not have (a status on a standings row) is skipped, so no list gains a field its
 * schema does not know.
 */
function applyCarOverridesToEntry<Entry extends PositionEntry | StandingsEntry>(
  entry: Entry,
  carOverrides: Override[],
): Entry {
  let correctedEntry = entry;
  for (const override of carOverrides) {
    const isThisCar = override.scope === 'car' && override.carNumber === entry.carNumber;
    if (isThisCar && isFieldOfTheList(entry, override.field)) {
      correctedEntry = { ...correctedEntry, [override.field]: override.value };
    }
  }
  return correctedEntry;
}

/**
 * Whether a car field belongs to the kind of list this entry comes from: team and school
 * are in both, status in the positions only. A positions entry is told by its `position`
 * (a standings entry has a `rank` instead).
 */
function isFieldOfTheList(entry: PositionEntry | StandingsEntry, field: string): boolean {
  const isPositionEntry = Object.hasOwn(entry, 'position');
  if (field === 'status') {
    return isPositionEntry;
  }
  return true;
}
