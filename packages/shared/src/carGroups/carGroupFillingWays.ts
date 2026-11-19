import { CarFieldMeaningSchema } from './carGroup.js';

/**
 * The part of a group these questions read: its fields and their meanings. A group as the
 * control page holds it fits, and so does one as a manifest writes it, before its check.
 */
type FieldsOfACarGroup = { fields: Record<string, string> };

/**
 * What a field of a group may show when the group is filled from one team record in
 * Cadastros (BAJAOVRLAY-80): an attribute of a team, by the key the entity library gives it
 * (entityAttributes.ts). Written out by hand like carFieldMeanings, so the type lists them;
 * carGroupFillingWays.test.ts fails if this list and the library's drift apart.
 */
export const teamRecordFieldMeanings = [
  'carNumber',
  'teamName',
  'schoolName',
  'schoolFullName',
  'city',
  'state',
  'logoUrl',
  'carPhotoUrl',
  'logoOnLightPlate',
] as const;

/** One of teamRecordFieldMeanings: which attribute of the team a graphic's field shows. */
export type TeamRecordFieldMeaning = (typeof teamRecordFieldMeanings)[number];

/** True when a meaning names a field of a car in the positions (`laps`, `teamName`…). */
export function isMeaningAFieldOfACarInThePositions(meaning: string): boolean {
  return CarFieldMeaningSchema.safeParse(meaning).success;
}

/** True when a meaning names an attribute of a team record (`city`, `logoUrl`…). */
export function isMeaningAnAttributeOfATeamRecord(meaning: string): boolean {
  const teamMeanings: readonly string[] = teamRecordFieldMeanings;
  return teamMeanings.includes(meaning);
}

/**
 * True when one car picked in the positions (by number or by place) can fill the whole
 * group: every meaning is a field of a car there. The team card's city is not, so its
 * group is never offered "Pelo número do carro".
 */
export function canCarGroupBeFilledFromThePositions(carGroup: FieldsOfACarGroup): boolean {
  return Object.values(carGroup.fields).every(isMeaningAFieldOfACarInThePositions);
}

/**
 * True when one team record of Cadastros can fill the whole group: every meaning is an
 * attribute of a team. The battle card's laps are not, so its cars are never offered it.
 */
export function canCarGroupBeFilledFromATeamRecord(carGroup: FieldsOfACarGroup): boolean {
  return Object.values(carGroup.fields).every(isMeaningAnAttributeOfATeamRecord);
}
