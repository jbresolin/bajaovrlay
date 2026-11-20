import { z } from 'zod';

import {
  listValueTypesThatFitDataSchemaField,
  readSchemaPropertyOfField,
} from '../bindings/bindingFitsGraphicField.js';
import { findBindablePath } from '../dataShapes/bindablePaths.js';
import { listAttributesThatFitDataSchemaField } from '../entities/entityFitsGraphicField.js';
import { CarFieldMeaningSchema, type CarGroup, CarGroupSchema } from './carGroup.js';
import {
  canCarGroupBeFilledFromATeamRecord,
  canCarGroupBeFilledFromThePositions,
  CarGroupFieldMeaningSchema,
  isMeaningAFieldOfACarInThePositions,
  isMeaningAnAttributeOfATeamRecord,
} from './carGroupFillingWays.js';
import { buildPathOfCarFieldChosenByNumber } from './carGroupPaths.js';

/**
 * The parts of a manifest its car groups are checked with: its data schema and its
 * `v_baja.carGroups`. Loose, so the rest of the manifest passes through untouched. The
 * check across them (superRefine) refuses, each with a sentence naming it: a group
 * declared twice, a group with no field, a field the data schema does not have, a field
 * in two groups, an unknown meaning, a group no one pick can fill (BAJAOVRLAY-80: a
 * position beside a city), a meaning whose value does not fit the field, and a group said
 * to run right behind a group that does not exist.
 * The sentences are for the graphic's author (the server's boot log), so they are English.
 */
export const ManifestCarGroupsSchema = z
  .looseObject({
    schema: z.record(z.string(), z.unknown()).optional(),
    v_baja: z.looseObject({ carGroups: z.array(CarGroupSchema).optional() }).optional(),
  })
  .superRefine((manifest, context) => {
    const carGroups = manifest.v_baja?.carGroups ?? [];
    for (const problem of findProblemsInCarGroups(carGroups, manifest.schema)) {
      context.addIssue({ code: 'custom', path: ['v_baja', 'carGroups'], message: problem });
    }
  });

/** A checked group's fields, each key with its meaning, as the control page receives them. */
const fieldMeaningsSchema = z.record(z.string(), CarGroupFieldMeaningSchema);

/** One car group as written, after the shape check and before the check across groups. */
type CarGroupAsWritten = z.infer<typeof CarGroupSchema>;

/** Every mistake of a manifest's car groups, as sentences; empty when there is none. */
function findProblemsInCarGroups(carGroups: CarGroupAsWritten[], dataSchema: unknown): string[] {
  const problems: string[] = [];
  const groupIdsSeen = new Set<string>();
  // The group each field was first seen in, to name both groups of a field in two.
  const groupIdOfEachField = new Map<string, string>();

  for (const carGroup of carGroups) {
    if (groupIdsSeen.has(carGroup.id)) {
      problems.push(`the car group "${carGroup.id}" is declared twice`);
    }
    groupIdsSeen.add(carGroup.id);

    const fieldEntries = Object.entries(carGroup.fields);
    if (fieldEntries.length === 0) {
      problems.push(`the car group "${carGroup.id}" has no field`);
    }
    let isEveryFieldKnown = true;
    for (const [fieldKey, meaningAsWritten] of fieldEntries) {
      const groupIdSeenBefore = groupIdOfEachField.get(fieldKey);
      if (groupIdSeenBefore !== undefined) {
        problems.push(
          `the field "${fieldKey}" is in two car groups ("${groupIdSeenBefore}" and "${carGroup.id}")`,
        );
      } else {
        groupIdOfEachField.set(fieldKey, carGroup.id);
      }
      const problemOfTheField = findProblemOfOneField(
        carGroup.id,
        fieldKey,
        meaningAsWritten,
        dataSchema,
      );
      if (problemOfTheField !== undefined) {
        problems.push(problemOfTheField);
        isEveryFieldKnown = false;
      }
    }
    // The ways are judged only once every field is known, or one misspelt meaning would
    // also be reported as a mix of the two ways.
    if (isEveryFieldKnown && fieldEntries.length > 0) {
      problems.push(...findProblemsOfTheWaysOfOneGroup(carGroup, dataSchema));
    }
  }

  // Checked once every id is known, so a group may name one written after it.
  for (const carGroup of carGroups) {
    const groupAhead = carGroup.rightBehindGroup;
    if (groupAhead !== undefined && (!groupIdsSeen.has(groupAhead) || groupAhead === carGroup.id)) {
      problems.push(
        `the car group "${carGroup.id}" runs right behind "${groupAhead}", which is no car group`,
      );
    }
  }
  return problems;
}

/**
 * Whether one field of a group exists in the data schema and has a meaning some way can
 * fill: a field of a car in the positions, or an attribute of a team record.
 */
function findProblemOfOneField(
  groupId: string,
  fieldKey: string,
  meaningAsWritten: string,
  dataSchema: unknown,
): string | undefined {
  if (readSchemaPropertyOfField(dataSchema, fieldKey) === undefined) {
    return `the car group "${groupId}" names the field "${fieldKey}", which the data schema does not have`;
  }
  const isMeaningKnown =
    isMeaningAFieldOfACarInThePositions(meaningAsWritten) ||
    isMeaningAnAttributeOfATeamRecord(meaningAsWritten);
  if (!isMeaningKnown) {
    return `the car group "${groupId}" gives the field "${fieldKey}" the meaning "${meaningAsWritten}", which is not a field of a car nor an attribute of a team`;
  }
  return undefined;
}

/** True when a car's field of this meaning, read from the positions, fits the field. */
function doesPositionsMeaningFitTheField(
  meaning: string,
  fieldKey: string,
  dataSchema: unknown,
): boolean {
  const meaningReading = CarFieldMeaningSchema.safeParse(meaning);
  if (!meaningReading.success) {
    return false;
  }
  const pathOfTheMeaning = buildPathOfCarFieldChosenByNumber(meaningReading.data);
  const valueTypeOfTheMeaning = findBindablePath('positions', pathOfTheMeaning)?.valueType;
  const valueTypesThatFit = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  return valueTypeOfTheMeaning !== undefined && valueTypesThatFit.includes(valueTypeOfTheMeaning);
}

/** True when a team record's attribute of this meaning fits the field (a logo an image). */
function doesTeamAttributeFitTheField(
  meaning: string,
  fieldKey: string,
  dataSchema: unknown,
): boolean {
  const attributesThatFit = listAttributesThatFitDataSchemaField('team', dataSchema, fieldKey);
  return attributesThatFit.some((attribute) => attribute.attributeKey === meaning);
}

/**
 * The mistakes of one group whose fields all exist and all have a known meaning: no way
 * fills every field (a position beside a city), or a field its meaning does not fit by a
 * way the group offers (a team name in a whole-number field). The fit is checked for
 * every way the meanings allow, as the editor offers each of them.
 */
function findProblemsOfTheWaysOfOneGroup(
  carGroup: CarGroupAsWritten,
  dataSchema: unknown,
): string[] {
  const isFilledFromThePositions = canCarGroupBeFilledFromThePositions(carGroup);
  const isFilledFromATeamRecord = canCarGroupBeFilledFromATeamRecord(carGroup);
  if (!isFilledFromThePositions && !isFilledFromATeamRecord) {
    return [
      `the car group "${carGroup.id}" mixes fields only the positions have with attributes only a team record has, so no one pick fills it`,
    ];
  }
  const problems: string[] = [];
  for (const [fieldKey, meaning] of Object.entries(carGroup.fields)) {
    const doesNotFitThePositions =
      isFilledFromThePositions && !doesPositionsMeaningFitTheField(meaning, fieldKey, dataSchema);
    const doesNotFitTheTeamRecord =
      isFilledFromATeamRecord && !doesTeamAttributeFitTheField(meaning, fieldKey, dataSchema);
    if (doesNotFitThePositions || doesNotFitTheTeamRecord) {
      problems.push(
        `the car group "${carGroup.id}" gives the field "${fieldKey}" the meaning "${meaning}", whose value does not fit it`,
      );
    }
  }
  return problems;
}

/**
 * What reading a manifest's car groups gives: none declared, the groups, or the
 * sentences saying why they are refused (a refused manifest keeps its fields one by one).
 */
export type CarGroupsOfManifestReading =
  | { status: 'none' }
  | { status: 'groups'; carGroups: CarGroup[] }
  | { status: 'refused'; problems: string[] };

/**
 * One refusal as the boot warning logs it, after where it is in the manifest
 * (`v_baja.carGroups.0.label: …`): a shape issue's own message names no group.
 */
function describeIssueWithWhereItIs(issue: z.core.$ZodIssue): string {
  const whereItIs = issue.path.join('.');
  return whereItIs === '' ? issue.message : `${whereItIs}: ${issue.message}`;
}

/**
 * Reads a manifest's `v_baja.carGroups` against its own data schema. Pure; never throws.
 * Refused as a whole on any mistake: half a group would let the picker fill some of a
 * car's fields and leave the rest on another car.
 */
export function readCarGroupsOfManifest(manifest: unknown): CarGroupsOfManifestReading {
  const reading = ManifestCarGroupsSchema.safeParse(manifest);
  if (!reading.success) {
    return {
      status: 'refused',
      problems: reading.error.issues.map(describeIssueWithWhereItIs),
    };
  }
  const carGroupsAsWritten = reading.data.v_baja?.carGroups;
  if (carGroupsAsWritten === undefined) {
    return { status: 'none' };
  }
  const carGroups: CarGroup[] = carGroupsAsWritten.map((carGroup) => {
    // Every meaning passed the check above (a field of a car or an attribute of a team),
    // so this parse cannot fail here; it gives the meanings their type without a cast.
    const fields = fieldMeaningsSchema.parse(carGroup.fields);
    return { ...carGroup, fields };
  });
  return { status: 'groups', carGroups };
}
