import type { Person } from './person.js';
import { ptBREntities } from './ptBREntities.js';
import type { ScheduleSlot } from './scheduleSlot.js';
import type { Sponsor } from './sponsor.js';
import type { Team } from './team.js';

/**
 * The four slices of the entity library together, as plain data from the slices: what
 * an entity reference is resolved against and what an image's uses are looked up in.
 */
export type EntityLibrary = {
  teams: Team[];
  people: Person[];
  sponsors: Sponsor[];
  scheduleSlots: ScheduleSlot[];
};

/** A team as people name it: "Equipe 42 (Baja UFPR)". */
export function describeTeam(team: Team): string {
  return ptBREntities.recordDescriptions.team(team.carNumber, team.teamName);
}

/** A person as people name them: "João Bresolin (Narrador)". */
export function describePerson(person: Person): string {
  return ptBREntities.recordDescriptions.person(person.name, person.role);
}

/** A sponsor as people name it: "Patrocinador Mineradora Serra Azul". */
export function describeSponsor(sponsor: Sponsor): string {
  return ptBREntities.recordDescriptions.sponsor(sponsor.name);
}

/** A schedule slot as people name it: "Programação: Enduro de Resistência". */
export function describeScheduleSlot(slot: ScheduleSlot): string {
  return ptBREntities.recordDescriptions.scheduleSlot(slot.sessionName);
}
