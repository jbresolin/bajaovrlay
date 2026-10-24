import type { EntityType } from './entityType.js';
import { ptBREntities } from './ptBREntities.js';

/**
 * What an attribute gives a graphic: a text, a whole number, a yes or no (a switch field),
 * or the URL of an image of the media store (/media/<mediaId>), which only an image field
 * takes.
 */
export type EntityValueType = 'text' | 'integer' | 'boolean' | 'imageUrl';

/**
 * One attribute an entity reference may read: its key in the reference, its pt-BR label,
 * what it gives, the record field it reads (for an image, the media id field), and
 * whether a record may lack it (then a take leaves an optional field out).
 */
export type EntityAttribute = {
  attributeKey: string;
  label: string;
  valueType: EntityValueType;
  recordFieldKey: string;
  isOptional: boolean;
};

const teamLabels = ptBREntities.teamFieldLabels;
const personLabels = ptBREntities.personFieldLabels;
const sponsorLabels = ptBREntities.sponsorFieldLabels;
const slotLabels = ptBREntities.scheduleSlotFieldLabels;

/**
 * Every attribute of each kind of record, listed by hand in the order the item editor
 * shows them (as listBindablePathsOfShape lists a shape's paths). An image's attribute
 * ends in Url (logoUrl) because the value is the image's address, not its media id. A
 * schedule slot's status is left out on purpose: it changes with the clock, and nothing
 * refreshes the air when only time passes, so it would go stale on air.
 */
const attributesByEntityType: Record<EntityType, EntityAttribute[]> = {
  team: [
    {
      attributeKey: 'carNumber',
      label: teamLabels.carNumber,
      valueType: 'integer',
      recordFieldKey: 'carNumber',
      isOptional: false,
    },
    {
      attributeKey: 'teamName',
      label: teamLabels.teamName,
      valueType: 'text',
      recordFieldKey: 'teamName',
      isOptional: false,
    },
    {
      attributeKey: 'schoolName',
      label: teamLabels.schoolName,
      valueType: 'text',
      recordFieldKey: 'schoolName',
      isOptional: false,
    },
    {
      attributeKey: 'schoolFullName',
      label: teamLabels.schoolFullName,
      valueType: 'text',
      recordFieldKey: 'schoolFullName',
      isOptional: true,
    },
    {
      attributeKey: 'city',
      label: teamLabels.city,
      valueType: 'text',
      recordFieldKey: 'city',
      isOptional: true,
    },
    {
      attributeKey: 'state',
      label: teamLabels.state,
      valueType: 'text',
      recordFieldKey: 'state',
      isOptional: true,
    },
    {
      attributeKey: 'logoUrl',
      label: teamLabels.logoMediaId,
      valueType: 'imageUrl',
      recordFieldKey: 'logoMediaId',
      isOptional: true,
    },
    {
      attributeKey: 'carPhotoUrl',
      label: teamLabels.carPhotoMediaId,
      valueType: 'imageUrl',
      recordFieldKey: 'carPhotoMediaId',
      isOptional: true,
    },
    {
      attributeKey: 'logoOnLightPlate',
      label: teamLabels.logoOnLightPlate,
      valueType: 'boolean',
      recordFieldKey: 'logoOnLightPlate',
      isOptional: true,
    },
  ],
  person: [
    {
      attributeKey: 'name',
      label: personLabels.name,
      valueType: 'text',
      recordFieldKey: 'name',
      isOptional: false,
    },
    {
      attributeKey: 'role',
      label: personLabels.role,
      valueType: 'text',
      recordFieldKey: 'role',
      isOptional: false,
    },
    {
      attributeKey: 'carNumber',
      label: personLabels.carNumber,
      valueType: 'integer',
      recordFieldKey: 'carNumber',
      isOptional: true,
    },
    {
      attributeKey: 'photoUrl',
      label: personLabels.photoMediaId,
      valueType: 'imageUrl',
      recordFieldKey: 'photoMediaId',
      isOptional: true,
    },
  ],
  sponsor: [
    {
      attributeKey: 'name',
      label: sponsorLabels.name,
      valueType: 'text',
      recordFieldKey: 'name',
      isOptional: false,
    },
    {
      attributeKey: 'tier',
      label: sponsorLabels.tier,
      valueType: 'text',
      recordFieldKey: 'tier',
      isOptional: false,
    },
    {
      attributeKey: 'rollWeight',
      label: sponsorLabels.rollWeight,
      valueType: 'integer',
      recordFieldKey: 'rollWeight',
      isOptional: false,
    },
    {
      attributeKey: 'logoUrl',
      label: sponsorLabels.logoMediaId,
      valueType: 'imageUrl',
      recordFieldKey: 'logoMediaId',
      isOptional: true,
    },
    {
      attributeKey: 'logoOnLightPlate',
      label: sponsorLabels.logoOnLightPlate,
      valueType: 'boolean',
      recordFieldKey: 'logoOnLightPlate',
      isOptional: true,
    },
  ],
  scheduleSlot: [
    {
      attributeKey: 'sessionName',
      label: slotLabels.sessionName,
      valueType: 'text',
      recordFieldKey: 'sessionName',
      isOptional: false,
    },
    {
      attributeKey: 'sessionKind',
      label: slotLabels.sessionKind,
      valueType: 'text',
      recordFieldKey: 'sessionKind',
      isOptional: false,
    },
    {
      attributeKey: 'startsAtMs',
      label: slotLabels.startsAtMs,
      valueType: 'integer',
      recordFieldKey: 'startsAtMs',
      isOptional: false,
    },
    {
      attributeKey: 'endsAtMs',
      label: slotLabels.endsAtMs,
      valueType: 'integer',
      recordFieldKey: 'endsAtMs',
      isOptional: true,
    },
    {
      attributeKey: 'place',
      label: slotLabels.place,
      valueType: 'text',
      recordFieldKey: 'place',
      isOptional: true,
    },
  ],
};

/** Every attribute of one kind of record, in the order the editor lists them. */
export function listAttributesOfEntityType(entityType: EntityType): EntityAttribute[] {
  return attributesByEntityType[entityType];
}

/** One attribute of a kind of record by its key, or undefined when that kind has none. */
export function findEntityAttribute(
  entityType: EntityType,
  attributeKey: string,
): EntityAttribute | undefined {
  return attributesByEntityType[entityType].find(
    (attribute) => attribute.attributeKey === attributeKey,
  );
}

/** "Equipe › Logo": the attribute as a picker and a refusal name it. */
export function labelOfEntityAttribute(entityType: EntityType, attribute: EntityAttribute): string {
  return `${ptBREntities.entityTypeNames[entityType]}${ptBREntities.labelSeparator}${attribute.label}`;
}
