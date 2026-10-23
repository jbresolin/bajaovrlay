import {
  type DeleteEntityCommand,
  describePerson,
  describeScheduleSlot,
  describeSponsor,
  describeTeam,
  type EntityLibrary,
  type EntityType,
  type Person,
  PersonSchema,
  type ScheduleSlot,
  ScheduleSlotSchema,
  type Sponsor,
  SponsorSchema,
  type Team,
  TeamSchema,
  type UpsertEntityCommand,
} from '@bajaovrlay/shared';
import type { z } from 'zod';

/**
 * Reading the four kinds of record alike, for the parts of the page that treat a tab's
 * records the same whatever their kind (the CSV import, the export, the table's keys).
 */

/** A record of any of the four kinds. */
export type AnyEntityRecord = Team | Person | Sponsor | ScheduleSlot;

/** The records of one kind, told apart by their type, as importEntities carries them. */
export type RecordsOfType =
  | { entityType: 'team'; records: Team[] }
  | { entityType: 'person'; records: Person[] }
  | { entityType: 'sponsor'; records: Sponsor[] }
  | { entityType: 'scheduleSlot'; records: ScheduleSlot[] };

/** The records of one kind the library holds. */
export function listRecordsOfType(
  library: EntityLibrary,
  entityType: EntityType,
): AnyEntityRecord[] {
  switch (entityType) {
    case 'team':
      return library.teams;
    case 'person':
      return library.people;
    case 'sponsor':
      return library.sponsors;
    case 'scheduleSlot':
      return library.scheduleSlots;
  }
}

/** The shared schema of one kind of record: its pt-BR refusals are the CSV's reasons. */
export function readSchemaOfEntityType(entityType: EntityType): z.ZodType<AnyEntityRecord> {
  switch (entityType) {
    case 'team':
      return TeamSchema;
    case 'person':
      return PersonSchema;
    case 'sponsor':
      return SponsorSchema;
    case 'scheduleSlot':
      return ScheduleSlotSchema;
  }
}

/** How a record is named on the page: "Equipe 42 (Baja UFPR)", "João Bresolin (Narrador)". */
export function describeRecordOfType(entityType: EntityType, record: AnyEntityRecord): string {
  switch (entityType) {
    case 'team':
      return describeTeam(record as Team);
    case 'person':
      return describePerson(record as Person);
    case 'sponsor':
      return describeSponsor(record as Sponsor);
    case 'scheduleSlot':
      return describeScheduleSlot(record as ScheduleSlot);
  }
}

/**
 * The records gathered under their type, as the page sends importEntities. The records
 * were each checked by the schema of `entityType`, so the cast only names what is known.
 */
export function gatherRecordsOfType(
  entityType: EntityType,
  records: AnyEntityRecord[],
): RecordsOfType {
  switch (entityType) {
    case 'team':
      return { entityType: 'team', records: records as Team[] };
    case 'person':
      return { entityType: 'person', records: records as Person[] };
    case 'sponsor':
      return { entityType: 'sponsor', records: records as Sponsor[] };
    case 'scheduleSlot':
      return { entityType: 'scheduleSlot', records: records as ScheduleSlot[] };
  }
}

/** The upsertEntity "Salvar" sends for a record checked by the schema of its type. */
export function buildUpsertCommandOfRecord(
  entityType: EntityType,
  record: AnyEntityRecord,
): UpsertEntityCommand {
  switch (entityType) {
    case 'team':
      return { type: 'upsertEntity', entityType: 'team', record: record as Team };
    case 'person':
      return { type: 'upsertEntity', entityType: 'person', record: record as Person };
    case 'sponsor':
      return { type: 'upsertEntity', entityType: 'sponsor', record: record as Sponsor };
    case 'scheduleSlot':
      return { type: 'upsertEntity', entityType: 'scheduleSlot', record: record as ScheduleSlot };
  }
}

/** The deleteEntity "Excluir" sends for a record: its type and its key. */
export function buildDeleteCommandOfRecord(
  entityType: EntityType,
  record: AnyEntityRecord,
): DeleteEntityCommand {
  switch (entityType) {
    case 'team':
      return { type: 'deleteEntity', entityType: 'team', carNumber: (record as Team).carNumber };
    case 'person':
      return { type: 'deleteEntity', entityType: 'person', personId: (record as Person).personId };
    case 'sponsor':
      return {
        type: 'deleteEntity',
        entityType: 'sponsor',
        sponsorId: (record as Sponsor).sponsorId,
      };
    case 'scheduleSlot':
      return {
        type: 'deleteEntity',
        entityType: 'scheduleSlot',
        slotId: (record as ScheduleSlot).slotId,
      };
  }
}

/** The key of a record, to tell the rows of a table apart: a car number or an id. */
export function readKeyOfRecord(entityType: EntityType, record: AnyEntityRecord): string {
  switch (entityType) {
    case 'team':
      return String((record as Team).carNumber);
    case 'person':
      return (record as Person).personId;
    case 'sponsor':
      return (record as Sponsor).sponsorId;
    case 'scheduleSlot':
      return (record as ScheduleSlot).slotId;
  }
}
