// Test support: the team card's one team group and its form filled from stored fields, as
// the team-record tests read them (BAJAOVRLAY-80). The group comes from the card's real
// manifest; every function builds fresh objects on each call.
import noticeManifest from '@bajaovrlay/notice/notice.ograf.json';
import {
  type CarGroup,
  type EntityFieldValue,
  type ItemFields,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';
import teamCardManifest from '@bajaovrlay/team-card/team-card.ograf.json';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormValues } from './schemaFormValues';

/** The one group a manifest declares, read with the shared check. */
function readOnlyGroupOfManifest(manifest: unknown, graphicName: string): CarGroup {
  const reading = readCarGroupsOfManifest(manifest);
  const carGroup = reading.status === 'groups' ? reading.carGroups[0] : undefined;
  if (carGroup === undefined) {
    throw new Error(`the ${graphicName}'s manifest must declare a car group`);
  }
  return carGroup;
}

/** The team card's group "Equipe", read from its real manifest. */
export function readTeamCardGroup(): CarGroup {
  return readOnlyGroupOfManifest(teamCardManifest, 'team card');
}

/** The notice's group "Carro" (number, team, school), read from its real manifest. */
export function readNoticeCarGroup(): CarGroup {
  return readOnlyGroupOfManifest(noticeManifest, 'notice');
}

/** A reference to one attribute of the team of this car in Cadastros. */
export function buildTeamReference(carNumber: number, attribute: string): EntityFieldValue {
  return { kind: 'entity', entityType: 'team', carNumber, attribute };
}

/** Every field of the team card reading its own attribute of one team, as a pick saves them. */
export function buildTeamCardFieldsReadingTeam(carNumber: number): ItemFields {
  return {
    carNumber: buildTeamReference(carNumber, 'carNumber'),
    teamName: buildTeamReference(carNumber, 'teamName'),
    schoolName: buildTeamReference(carNumber, 'schoolName'),
    city: buildTeamReference(carNumber, 'city'),
    state: buildTeamReference(carNumber, 'state'),
    carPhotoUrl: buildTeamReference(carNumber, 'carPhotoUrl'),
    logoUrl: buildTeamReference(carNumber, 'logoUrl'),
    logoOnLightPlate: buildTeamReference(carNumber, 'logoOnLightPlate'),
  };
}

/** The team card's form filled from these stored fields, as the item editor fills it. */
export function fillTeamCardFormFrom(fields: ItemFields): SchemaFormValues {
  const description = describeSchemaFormFromDataSchema(teamCardManifest.schema);
  return buildSchemaFormValuesFromItemFields(description, fields).formValues;
}

/** The team card's form for a new item: the manifest's defaults, the plate switch off. */
export function fillTeamCardFormForANewItem(): SchemaFormValues {
  return buildEmptySchemaFormValues(describeSchemaFormFromDataSchema(teamCardManifest.schema));
}

/** The notice's form for a new item: its manifest's defaults. */
export function fillNoticeFormForANewItem(): SchemaFormValues {
  return buildEmptySchemaFormValues(describeSchemaFormFromDataSchema(noticeManifest.schema));
}
