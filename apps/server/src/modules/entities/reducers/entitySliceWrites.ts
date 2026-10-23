// How each kind of record is keyed, and how a reducer writes one entity slice back,
// shared by upsertEntity, importEntities and deleteEntity.
import type { Person, ScheduleSlot, Sponsor, Team } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/** A team's key: its car number, the key of the positions shape. */
export function readKeyOfTeam(team: Team): number {
  return team.carNumber;
}

/** A person's key: its id. */
export function readKeyOfPerson(person: Person): string {
  return person.personId;
}

/** A sponsor's key: its id. */
export function readKeyOfSponsor(sponsor: Sponsor): string {
  return sponsor.sponsorId;
}

/** A schedule slot's key: its id. */
export function readKeyOfScheduleSlot(slot: ScheduleSlot): string {
  return slot.slotId;
}

/** The applied outcome with these teams; the same slices when the list did not change. */
export function writeTeams(slices: SlicesChangedByCommands, teams: Team[]): ReducerOutcome {
  return { status: 'applied', slices: teams === slices.teams ? slices : { ...slices, teams } };
}

/** The applied outcome with these people; the same slices when the list did not change. */
export function writePeople(slices: SlicesChangedByCommands, people: Person[]): ReducerOutcome {
  return { status: 'applied', slices: people === slices.people ? slices : { ...slices, people } };
}

/** The applied outcome with these sponsors; the same slices when the list did not change. */
export function writeSponsors(
  slices: SlicesChangedByCommands,
  sponsors: Sponsor[],
): ReducerOutcome {
  return {
    status: 'applied',
    slices: sponsors === slices.sponsors ? slices : { ...slices, sponsors },
  };
}

/** The applied outcome with these slots; the same slices when the list did not change. */
export function writeScheduleSlots(
  slices: SlicesChangedByCommands,
  scheduleSlots: ScheduleSlot[],
): ReducerOutcome {
  return {
    status: 'applied',
    slices: scheduleSlots === slices.scheduleSlots ? slices : { ...slices, scheduleSlots },
  };
}
