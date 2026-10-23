// Everything about the entity library (teams, people, sponsors, the schedule) that
// @bajaovrlay/shared exports. The package's own index.ts re-exports this file with one
// line; other packages import from '@bajaovrlay/shared', never from here.

// The four kinds of record: team, person, sponsor, scheduleSlot.
export { type EntityType, EntityTypeSchema } from './entityType.js';
// A team, keyed by car number, and the teams slice (each car once).
export { type Team, type Teams, TeamSchema, TeamsSchema } from './team.js';
// A person (narrator, judge, team member) and the people slice (each id once).
export { type People, PeopleSchema, type Person, PersonSchema } from './person.js';
// A sponsor with its tier and roll weight, and the sponsors slice (each id once).
export {
  type Sponsor,
  type Sponsors,
  SponsorSchema,
  SponsorsSchema,
  type SponsorTier,
  SponsorTierSchema,
} from './sponsor.js';
// A slot of the schedule, and the scheduleSlots slice (each id once).
export {
  type ScheduleSlot,
  type ScheduleSlots,
  ScheduleSlotSchema,
  ScheduleSlotsSchema,
} from './scheduleSlot.js';
// What the schedule says about a slot at a moment (never stored), and its pt-BR word.
export {
  findStatusOfScheduleSlot,
  labelOfScheduleSlotStatus,
  type ScheduleSlotStatus,
} from './scheduleSlotStatus.js';
// The two-letter state codes a team's `state` takes.
export { type BrazilianStateCode, BrazilianStateCodeSchema } from './brazilianStates.js';
// The three commands: upsert one record, delete one by its key, import many of one type.
export { type DeleteEntityCommand, DeleteEntityCommandSchema } from './deleteEntity.js';
export {
  type ImportEntitiesCommand,
  ImportEntitiesCommandSchema,
  mostRecordsInOneImport,
} from './importEntities.js';
export { type UpsertEntityCommand, UpsertEntityCommandSchema } from './upsertEntity.js';
// The labels and refusal sentences in pt-BR, shared by the server, the form and the CSV.
export { ptBREntities } from './ptBREntities.js';
