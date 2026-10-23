import { buildMediaUrl } from '../media/mediaId.js';
import { findEntityAttribute, labelOfEntityAttribute } from './entityAttributes.js';
import type { EntityFieldValue } from './entityFieldValue.js';
import {
  describePerson,
  describeScheduleSlot,
  describeSponsor,
  describeTeam,
  type EntityLibrary,
} from './entityLibrary.js';
import { ptBREntities } from './ptBREntities.js';

/**
 * What reading one entity reference gives, as for a binding (BindingResolution):
 * - `resolved`: the value (an image as its /media URL);
 * - `valueAbsent`: the record lacks this optional attribute (no logo yet); the take
 *   leaves an optional field out, so the graphic shows its no-logo state;
 * - `unresolvable`: no such record (deleted, or never typed), or no such attribute.
 * Each problem is a pt-BR sentence the server puts the field's title before.
 */
export type EntityReferenceResolution =
  | { status: 'resolved'; value: string | number }
  | { status: 'valueAbsent'; problem: string }
  | { status: 'unresolvable'; problem: string };

/** A record found for a reference: its fields to read, and how a sentence names it. */
type RecordFound = { recordFields: Record<string, unknown>; recordDescription: string };

/**
 * Reads the value one entity reference gives now: the record of its fixed key in the
 * library, then the attribute. An image attribute gives the image's URL
 * (/media/<mediaId>); the graphic draws it with <img>, which is loading an asset, not
 * fetching data (concept §3.3). Pure: it never throws and reads only what it is given.
 */
export function resolveEntityReferenceAgainstLibrary(
  reference: EntityFieldValue,
  library: EntityLibrary,
): EntityReferenceResolution {
  const attribute = findEntityAttribute(reference.entityType, reference.attribute);
  if (attribute === undefined) {
    const typeName = ptBREntities.entityTypeNames[reference.entityType];
    return {
      status: 'unresolvable',
      problem: ptBREntities.referenceProblems.unknownAttribute(typeName, reference.attribute),
    };
  }
  const recordFound = findRecordOfReference(reference, library);
  if (!recordFound.isFound) {
    return { status: 'unresolvable', problem: recordFound.problem };
  }
  const storedValue = recordFound.record.recordFields[attribute.recordFieldKey];
  if (storedValue === undefined) {
    const problem = ptBREntities.referenceProblems.attributeAbsent(
      recordFound.record.recordDescription,
      attribute.label,
    );
    return { status: 'valueAbsent', problem };
  }
  if (typeof storedValue !== 'string' && typeof storedValue !== 'number') {
    // The slices' schemas make every attribute a text or a number; anything else is a bug.
    const attributeLabel = labelOfEntityAttribute(reference.entityType, attribute);
    return { status: 'unresolvable', problem: attributeLabel };
  }
  if (attribute.valueType === 'imageUrl') {
    return { status: 'resolved', value: buildMediaUrl(String(storedValue)) };
  }
  return { status: 'resolved', value: storedValue };
}

/** The record of a reference's key, or the sentence saying it is not in the library. */
function findRecordOfReference(
  reference: EntityFieldValue,
  library: EntityLibrary,
): { isFound: true; record: RecordFound } | { isFound: false; problem: string } {
  const problems = ptBREntities.referenceProblems;
  switch (reference.entityType) {
    case 'team': {
      const team = library.teams.find((candidate) => candidate.carNumber === reference.carNumber);
      return team === undefined
        ? { isFound: false, problem: problems.teamNotFound(reference.carNumber) }
        : { isFound: true, record: { recordFields: team, recordDescription: describeTeam(team) } };
    }
    case 'person': {
      const person = library.people.find((candidate) => candidate.personId === reference.personId);
      return person === undefined
        ? { isFound: false, problem: problems.personNotFound }
        : {
            isFound: true,
            record: { recordFields: person, recordDescription: describePerson(person) },
          };
    }
    case 'sponsor': {
      const sponsor = library.sponsors.find(
        (candidate) => candidate.sponsorId === reference.sponsorId,
      );
      return sponsor === undefined
        ? { isFound: false, problem: problems.sponsorNotFound }
        : {
            isFound: true,
            record: { recordFields: sponsor, recordDescription: describeSponsor(sponsor) },
          };
    }
    case 'scheduleSlot': {
      const slot = library.scheduleSlots.find((candidate) => candidate.slotId === reference.slotId);
      return slot === undefined
        ? { isFound: false, problem: problems.scheduleSlotNotFound }
        : {
            isFound: true,
            record: { recordFields: slot, recordDescription: describeScheduleSlot(slot) },
          };
    }
  }
}
