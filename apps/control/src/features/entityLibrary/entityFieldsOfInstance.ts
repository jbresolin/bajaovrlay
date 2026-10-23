/**
 * What the page says about the fields of one instance that read the entity library: where
 * each reads ("Cadastro › Equipe 42 › Número do carro") and which record "Editar no
 * cadastro" opens. Read from the instance's entry of `instanceBindings`, never from its
 * item, as the server's refreshes are (gate 2 of PR #23).
 */
import {
  type EntityFieldValue,
  type EntityLibrary,
  type EntityValueType,
  findEntityAttribute,
  type InstanceBindings,
  ptBREntities,
} from '@bajaovrlay/shared';

import type { RecordToOpen } from '@/app/recordToOpen';
import { ptBR } from '@/i18n/ptBR';

/** One field of an instance that reads the library, described for the page. */
export type EntityFieldOfInstance = {
  fieldKey: string;
  /** "Cadastro › Equipe 42 › Número do carro". */
  whereItReadsText: string;
  /** What the attribute gives, to write the value on air; undefined for an unknown one. */
  valueType: EntityValueType | undefined;
  /** The record "Editar no cadastro" opens; undefined when it is no longer in the library. */
  recordToOpen: RecordToOpen | undefined;
};

/** Describes every field of the instance that reads the library, in its entry's order. */
export function describeEntityFieldsOfInstance(
  instanceId: string,
  instanceBindings: InstanceBindings,
  library: EntityLibrary,
): EntityFieldOfInstance[] {
  const entry = instanceBindings.find((candidate) => candidate.instanceId === instanceId);
  const entityFields = entry?.entityFields ?? [];
  return entityFields.map(({ fieldKey, entityReference }) => {
    const attribute = findEntityAttribute(entityReference.entityType, entityReference.attribute);
    const recordFound = findRecordNameOfReference(entityReference, library);
    return {
      fieldKey,
      whereItReadsText: ptBR.entityLibrary.onAir.whereItReads(
        recordFound.recordName,
        attribute?.label ?? entityReference.attribute,
      ),
      valueType: attribute?.valueType,
      recordToOpen: recordFound.isFound
        ? { entityType: entityReference.entityType, recordKey: readKeyOfReference(entityReference) }
        : undefined,
    };
  });
}

/**
 * How the field names its record: "Equipe 42", or the person's, sponsor's or session's
 * name; a record no longer in the library in words ("uma pessoa excluída dos cadastros").
 */
function findRecordNameOfReference(
  reference: EntityFieldValue,
  library: EntityLibrary,
): { isFound: boolean; recordName: string } {
  const missingNames = ptBREntities.missingRecordNames;
  switch (reference.entityType) {
    case 'team': {
      const team = library.teams.find((candidate) => candidate.carNumber === reference.carNumber);
      return team === undefined
        ? { isFound: false, recordName: missingNames.team(reference.carNumber) }
        : {
            isFound: true,
            recordName: `${ptBREntities.entityTypeNames.team} ${String(team.carNumber)}`,
          };
    }
    case 'person': {
      const person = library.people.find((candidate) => candidate.personId === reference.personId);
      return person === undefined
        ? { isFound: false, recordName: missingNames.person }
        : { isFound: true, recordName: person.name };
    }
    case 'sponsor': {
      const sponsor = library.sponsors.find(
        (candidate) => candidate.sponsorId === reference.sponsorId,
      );
      return sponsor === undefined
        ? { isFound: false, recordName: missingNames.sponsor }
        : { isFound: true, recordName: sponsor.name };
    }
    case 'scheduleSlot': {
      const slot = library.scheduleSlots.find((candidate) => candidate.slotId === reference.slotId);
      return slot === undefined
        ? { isFound: false, recordName: missingNames.scheduleSlot }
        : { isFound: true, recordName: slot.sessionName };
    }
  }
}

/** The key of the record a reference reads, as text: a car number or an id. */
function readKeyOfReference(reference: EntityFieldValue): string {
  switch (reference.entityType) {
    case 'team':
      return String(reference.carNumber);
    case 'person':
      return reference.personId;
    case 'sponsor':
      return reference.sponsorId;
    case 'scheduleSlot':
      return reference.slotId;
  }
}
