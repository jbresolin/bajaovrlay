// Loading the entity library at boot from the rows of the slices table.
import { type Slices, SlicesSchema } from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import { readStoredSponsorsInTheDesignsLevels } from './sponsorLevelMigration.js';

/** The four slices of the entity library, as the store starts with them. */
export type EntitySlicesAtBoot = Pick<Slices, 'teams' | 'people' | 'sponsors' | 'scheduleSlots'>;

/**
 * Reads the teams, people, sponsors and schedule from their stored rows. A database
 * written before BAJAOVRLAY-19 has none of these rows and starts with an empty library;
 * nothing is seeded, because the library is the operator's own data. A row that fails
 * its schema (two teams with one car number, a team with no UF) stops the boot, as the
 * items row does: an item would otherwise resolve against a record nobody can read.
 * The sponsors are read in the design's levels first (`master` becomes `diamante`,
 * BAJAOVRLAY-46), because the check refuses the old name.
 */
export function loadEntitySlices(storedRows: SliceRow[]): EntitySlicesAtBoot {
  const readStoredJson = (sliceName: keyof EntitySlicesAtBoot) =>
    storedRows.find((row) => row.name === sliceName)?.json ?? [];
  return {
    teams: SlicesSchema.shape.teams.parse(readStoredJson('teams')),
    people: SlicesSchema.shape.people.parse(readStoredJson('people')),
    sponsors: SlicesSchema.shape.sponsors.parse(
      readStoredSponsorsInTheDesignsLevels(readStoredJson('sponsors')),
    ),
    scheduleSlots: SlicesSchema.shape.scheduleSlots.parse(readStoredJson('scheduleSlots')),
  };
}
