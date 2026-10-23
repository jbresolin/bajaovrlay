import {
  describePerson,
  describeSponsor,
  describeTeam,
  type EntityLibrary,
} from '../entities/entityLibrary.js';
import type { Person } from '../entities/person.js';
import { ptBREntities } from '../entities/ptBREntities.js';
import type { ScheduleSlot } from '../entities/scheduleSlot.js';
import type { Sponsor } from '../entities/sponsor.js';
import type { Team } from '../entities/team.js';

/** One image a record names: the field (its pt-BR label) and the media id. */
export type MediaFieldOfRecord = { fieldLabel: string; mediaId: string };

/** One use of an image: the record that names it and the field, for people to read. */
export type MediaUse = { recordDescription: string; fieldLabel: string };

/** A record of one of the four kinds, told apart by its entity type. */
export type EntityRecordOfType =
  | { entityType: 'team'; record: Team }
  | { entityType: 'person'; record: Person }
  | { entityType: 'sponsor'; record: Sponsor }
  | { entityType: 'scheduleSlot'; record: ScheduleSlot };

/**
 * The images one record names, field by field, leaving out the fields it leaves empty:
 * a team's logo and car photo, a person's photo, a sponsor's logo; a schedule slot has
 * none. What upsertEntity and importEntities check against the media slice.
 */
export function listMediaFieldsOfRecord(recordOfType: EntityRecordOfType): MediaFieldOfRecord[] {
  const fields: Array<{ fieldLabel: string; mediaId: string | undefined }> = [];
  switch (recordOfType.entityType) {
    case 'team':
      fields.push({
        fieldLabel: ptBREntities.teamFieldLabels.logoMediaId,
        mediaId: recordOfType.record.logoMediaId,
      });
      fields.push({
        fieldLabel: ptBREntities.teamFieldLabels.carPhotoMediaId,
        mediaId: recordOfType.record.carPhotoMediaId,
      });
      break;
    case 'person':
      fields.push({
        fieldLabel: ptBREntities.personFieldLabels.photoMediaId,
        mediaId: recordOfType.record.photoMediaId,
      });
      break;
    case 'sponsor':
      fields.push({
        fieldLabel: ptBREntities.sponsorFieldLabels.logoMediaId,
        mediaId: recordOfType.record.logoMediaId,
      });
      break;
    case 'scheduleSlot':
      break;
  }
  const namedFields: MediaFieldOfRecord[] = [];
  for (const field of fields) {
    if (field.mediaId !== undefined) {
      namedFields.push({ fieldLabel: field.fieldLabel, mediaId: field.mediaId });
    }
  }
  return namedFields;
}

/**
 * Every use of one image in the library, in the order of the slices (teams, people,
 * sponsors): "Equipe 42 (Baja UFPR)" with "Logo". deleteMedia is refused while there is
 * one, and the Cadastros page shows the list next to each image.
 */
export function findUsesOfMedia(library: EntityLibrary, mediaId: string): MediaUse[] {
  const uses: MediaUse[] = [];
  const recordsWithTheirDescription: Array<{
    recordOfType: EntityRecordOfType;
    recordDescription: string;
  }> = [
    ...library.teams.map((team) => ({
      recordOfType: { entityType: 'team' as const, record: team },
      recordDescription: describeTeam(team),
    })),
    ...library.people.map((person) => ({
      recordOfType: { entityType: 'person' as const, record: person },
      recordDescription: describePerson(person),
    })),
    ...library.sponsors.map((sponsor) => ({
      recordOfType: { entityType: 'sponsor' as const, record: sponsor },
      recordDescription: describeSponsor(sponsor),
    })),
  ];
  for (const { recordOfType, recordDescription } of recordsWithTheirDescription) {
    for (const field of listMediaFieldsOfRecord(recordOfType)) {
      if (field.mediaId === mediaId) {
        uses.push({ recordDescription, fieldLabel: field.fieldLabel });
      }
    }
  }
  return uses;
}
