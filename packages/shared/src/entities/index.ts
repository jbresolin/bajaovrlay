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
// The six sponsor levels in round order (Diamante first, Realização last), with no Zod, so
// graphics bundle the same list from `@bajaovrlay/shared/sponsorLevels`.
export {
  findPlaceOfSponsorLevelInRound,
  type SponsorLevel,
  sponsorLevelsInRoundOrder,
} from './sponsorLevels.js';
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
// The four slices together, and how a refusal names one record ("Equipe 42 (Baja UFPR)").
export {
  describePerson,
  describeScheduleSlot,
  describeSponsor,
  describeTeam,
  type EntityLibrary,
} from './entityLibrary.js';
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
// The entity reference, a FieldValue that reads one attribute of one record (always live).
export { type EntityFieldValue, EntityFieldValueSchema } from './entityFieldValue.js';
// Every attribute a reference may read, by kind of record, with its label and value type.
export {
  type EntityAttribute,
  type EntityValueType,
  findEntityAttribute,
  labelOfEntityAttribute,
  listAttributesOfEntityType,
} from './entityAttributes.js';
// Which attributes fit a graphic's field (the imageUrl role), and the save check.
export {
  findProblemInEntityReferenceForDataSchemaField,
  imageUrlRole,
  isImageFieldOfDataSchema,
  listAttributesThatFitDataSchemaField,
  listEntityValueTypesThatFitDataSchemaField,
} from './entityFitsGraphicField.js';
// Reading one reference against the library: the value, absent, or why it cannot be read.
export {
  type EntityReferenceResolution,
  resolveEntityReferenceAgainstLibrary,
} from './entityReferenceResolution.js';
// The labels and refusal sentences in pt-BR, shared by the server, the form and the CSV.
export { ptBREntities } from './ptBREntities.js';
