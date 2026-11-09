// Test support: the battle card's car groups and its form filled from stored fields, as
// the carGroupChoice tests read them (BAJAOVRLAY-66). The groups come from the card's real
// manifest; every function builds fresh objects on each call.
import battleCardManifest from '@bajaovrlay/battle-card/battle-card.ograf.json';
import {
  type BindingFieldValue,
  type CarGroup,
  type ItemFields,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';

import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormValues } from './schemaFormValues';

/** The seeded simulator's id, as every binding of these tests names it. */
export const simulatorId = 'simulador-enduro';

/** One of the battle card's groups, read from its real manifest ("ahead" or "behind"). */
export function readBattleCardGroup(groupId: string): CarGroup {
  const reading = readCarGroupsOfManifest(battleCardManifest);
  const carGroup =
    reading.status === 'groups'
      ? reading.carGroups.find((candidate) => candidate.id === groupId)
      : undefined;
  if (carGroup === undefined) {
    throw new Error(`the battle card's manifest must declare the group ${groupId}`);
  }
  return carGroup;
}

/** A live binding of one positions path on the simulator, a car number when one is given. */
export function buildLiveBinding(path: string, carNumber?: number): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: simulatorId,
    shapeKey: 'positions',
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

/** The car ahead's five fields, each on car 31 chosen by number, as BAJAOVRLAY-47 stored them. */
export function buildFieldsOfTheCarAheadOnCar31(): ItemFields {
  return {
    aheadPosition: buildLiveBinding('entryOfCar.position', 31),
    aheadCarNumber: buildLiveBinding('entryOfCar.carNumber', 31),
    aheadTeamName: buildLiveBinding('entryOfCar.teamName', 31),
    aheadSchoolName: buildLiveBinding('entryOfCar.schoolName', 31),
    aheadLaps: buildLiveBinding('entryOfCar.laps', 31),
  };
}

/** The car ahead typed by hand: car 47 of Carnaúba Baja (UFERSA), 6th with 33 laps. */
export function buildFieldsOfTheCarAheadTypedAsCar47(): ItemFields {
  return {
    aheadPosition: { kind: 'literal', value: 6 },
    aheadCarNumber: { kind: 'literal', value: 47 },
    aheadTeamName: { kind: 'literal', value: 'Carnaúba Baja' },
    aheadSchoolName: { kind: 'literal', value: 'UFERSA' },
    aheadLaps: { kind: 'literal', value: 33 },
  };
}

/** The battle card's form filled from these stored fields, as the item editor fills it. */
export function fillBattleCardFormFrom(fields: ItemFields): SchemaFormValues {
  const description = describeSchemaFormFromDataSchema(battleCardManifest.schema);
  return buildSchemaFormValuesFromItemFields(description, fields).formValues;
}
