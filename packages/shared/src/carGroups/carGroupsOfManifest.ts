import { z } from 'zod';

import {
  listValueTypesThatFitDataSchemaField,
  readSchemaPropertyOfField,
} from '../bindings/bindingFitsGraphicField.js';
import { findBindablePath } from '../dataShapes/bindablePaths.js';
import { CarFieldMeaningSchema, type CarGroup, CarGroupSchema } from './carGroup.js';
import { buildPathOfCarFieldChosenByNumber } from './carGroupPaths.js';

/**
 * The parts of a manifest its car groups are checked with: its data schema and its
 * `v_baja.carGroups`. Loose, so the rest of the manifest passes through untouched. The
 * check across them (superRefine) refuses, each with a sentence naming it: a group
 * declared twice, a group with no field, a field the data schema does not have, a field
 * in two groups, an unknown meaning, a meaning whose value does not fit the field, and a
 * group said to run right behind a group that does not exist.
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
      }
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

/** Whether one field of a group exists in the data schema and can show its meaning. */
function findProblemOfOneField(
  groupId: string,
  fieldKey: string,
  meaningAsWritten: string,
  dataSchema: unknown,
): string | undefined {
  if (readSchemaPropertyOfField(dataSchema, fieldKey) === undefined) {
    return `the car group "${groupId}" names the field "${fieldKey}", which the data schema does not have`;
  }
  const meaningReading = CarFieldMeaningSchema.safeParse(meaningAsWritten);
  if (!meaningReading.success) {
    return `the car group "${groupId}" gives the field "${fieldKey}" the meaning "${meaningAsWritten}", which is not a field of a car`;
  }
  const pathOfTheMeaning = buildPathOfCarFieldChosenByNumber(meaningReading.data);
  const valueTypeOfTheMeaning = findBindablePath('positions', pathOfTheMeaning)?.valueType;
  const valueTypesThatFit = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  if (valueTypeOfTheMeaning === undefined || !valueTypesThatFit.includes(valueTypeOfTheMeaning)) {
    return `the car group "${groupId}" gives the field "${fieldKey}" the meaning "${meaningAsWritten}", whose value does not fit it`;
  }
  return undefined;
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
 * Reads a manifest's `v_baja.carGroups` against its own data schema. Pure; never throws.
 * Refused as a whole on any mistake: half a group would let the picker fill some of a
 * car's fields and leave the rest on another car.
 */
export function readCarGroupsOfManifest(manifest: unknown): CarGroupsOfManifestReading {
  const reading = ManifestCarGroupsSchema.safeParse(manifest);
  if (!reading.success) {
    return {
      status: 'refused',
      problems: reading.error.issues.map((issue) => issue.message),
    };
  }
  const carGroupsAsWritten = reading.data.v_baja?.carGroups;
  if (carGroupsAsWritten === undefined) {
    return { status: 'none' };
  }
  const carGroups = carGroupsAsWritten.map((carGroup) => {
    const fields: CarGroup['fields'] = {};
    for (const [fieldKey, meaningAsWritten] of Object.entries(carGroup.fields)) {
      // Every meaning passed the check above, so this parse cannot fail here.
      fields[fieldKey] = CarFieldMeaningSchema.parse(meaningAsWritten);
    }
    return { ...carGroup, fields };
  });
  return { status: 'groups', carGroups };
}
