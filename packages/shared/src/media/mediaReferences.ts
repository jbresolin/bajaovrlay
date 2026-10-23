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
import type { Item } from '../rundown/item.js';
import type { Instance } from '../slices/instance.js';
import { buildMediaUrl } from './mediaId.js';

/** One image a record names: the field (its pt-BR label) and the media id. */
export type MediaFieldOfRecord = { fieldLabel: string; mediaId: string };

/** One use of an image: the record that names it and the field, for people to read. */
export type MediaUse = { recordDescription: string; fieldLabel: string };

/**
 * Every place an image can be used in: the entity library, the items (a field typed with
 * the image picker holds "/media/<mediaId>") and the instances on air or in preview.
 */
export type PlacesThatUseMedia = EntityLibrary & { items: Item[]; instances: Instance[] };

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
 * Every use of one image: by a team, person or sponsor that names it ("Equipe 42 (Baja
 * UFPR)" with "Logo"), by an item field that holds its address as a typed value (the
 * image picker), and by an instance on air or in preview whose data shows it, at any
 * depth (a team deleted while its card is on air keeps its logo there, rule 4). deleteMedia
 * is refused while there is one, and "Limpar imagens sem uso" leaves such an image alone.
 */
export function findUsesOfMedia(places: PlacesThatUseMedia, mediaId: string): MediaUse[] {
  const library: EntityLibrary = places;
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
  const mediaUrl = buildMediaUrl(mediaId);
  for (const item of places.items) {
    for (const [fieldKey, fieldValue] of Object.entries(item.fields)) {
      if (fieldValue.kind === 'literal' && doesValueHoldText(fieldValue.value, mediaUrl)) {
        uses.push({
          recordDescription: ptBREntities.recordDescriptions.item(item.label),
          fieldLabel: fieldKey,
        });
      }
    }
  }
  for (const instance of places.instances) {
    const descriptions = ptBREntities.recordDescriptions;
    const recordDescription =
      instance.target === 'program'
        ? descriptions.instanceOnAir(instance.layerId)
        : descriptions.instanceInPreview(instance.layerId);
    for (const [fieldKey, value] of Object.entries(instance.resolvedData)) {
      if (doesValueHoldText(value, mediaUrl)) {
        uses.push({ recordDescription, fieldLabel: fieldKey });
      }
    }
  }
  return uses;
}

/**
 * Whether a value is this text, or holds it at any depth inside a list or an object (a
 * list of sponsors with their logos). Data on air is JSON, so nothing else needs looking in.
 */
function doesValueHoldText(value: unknown, text: string): boolean {
  if (value === text) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((element) => doesValueHoldText(element, text));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((element) => doesValueHoldText(element, text));
  }
  return false;
}
