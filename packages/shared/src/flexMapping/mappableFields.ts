import type { DataShapeKey } from '../dataShapes/dataShapeKey.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';

/** Whether a field belongs to the whole shape (`sessionId`) or to each entry of its list. */
export type MappableFieldLevel = 'topLevel' | 'entry';

/** One canonical field a mapping rule may fill, as the flex source form shows it. */
export type MappableField = {
  /** The canonical name, nested with a dot: "clock.referenceTimeMs". */
  targetField: string;
  /** The pt-BR label of the form's row and of a problem line: "Última volta". */
  label: string;
  /** True when the shape refuses a payload without it. */
  isRequired: boolean;
  level: MappableFieldLevel;
};

/**
 * Lists the canonical fields a mapping may fill in one shape, required fields first within
 * each level, top-level fields before entry fields. Written out by hand like
 * bindablePaths.ts: deriving it from the Zod schemas would need type-level code a reviewer
 * runs in their head. mappableFields.test.ts proves each field exists in its schema.
 * Brackets give an empty list: mapping that draft shape is not built (see the README).
 */
export function listMappableFieldsOfShape(shapeKey: DataShapeKey): MappableField[] {
  switch (shapeKey) {
    case 'session':
      return listSessionFields();
    case 'positions':
      return listPositionsFields();
    case 'standings':
      return listStandingsFields();
    case 'brackets':
      return [];
  }
}

/**
 * Finds one mappable field of a shape by its target name, at either level, or undefined
 * when the shape has no such field.
 */
export function findMappableField(
  shapeKey: DataShapeKey,
  targetField: string,
): MappableField | undefined {
  return listMappableFieldsOfShape(shapeKey).find((field) => field.targetField === targetField);
}

/** Builds a top-level field. */
function topLevelField(targetField: string, label: string, isRequired: boolean): MappableField {
  return { targetField, label, isRequired, level: 'topLevel' };
}

/** Builds an entry field. */
function entryField(targetField: string, label: string, isRequired: boolean): MappableField {
  return { targetField, label, isRequired, level: 'entry' };
}

/** "Relógio › Modo": a clock field's label carries the clock's own. */
function labelClockField(clockFieldLabel: string): string {
  return [ptBRDataShapes.sessionFieldLabels.clock, clockFieldLabel].join(
    ptBRDataShapes.labelSeparator,
  );
}

/** The session's fields, all top-level, the clock field by field. */
function listSessionFields(): MappableField[] {
  const sessionLabels = ptBRDataShapes.sessionFieldLabels;
  const clockLabels = ptBRDataShapes.clockFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('sessionId', extraLabels.sessionId, true),
    topLevelField('eventName', sessionLabels.eventName, true),
    topLevelField('sessionName', sessionLabels.sessionName, true),
    topLevelField('sessionKind', sessionLabels.sessionKind, true),
    topLevelField('state', sessionLabels.state, true),
    topLevelField('clock.clockMode', labelClockField(clockLabels.clockMode), true),
    topLevelField('clock.referenceTimeMs', labelClockField(clockLabels.referenceTimeMs), true),
    topLevelField(
      'clock.referenceWallClockMs',
      labelClockField(clockLabels.referenceWallClockMs),
      true,
    ),
    topLevelField('clock.running', labelClockField(clockLabels.running), true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    topLevelField('scheduledDurationMs', sessionLabels.scheduledDurationMs, false),
    topLevelField('lapsCompletedByLeader', sessionLabels.lapsCompletedByLeader, false),
  ];
}

/** The positions' own fields, then the fields of each car. */
function listPositionsFields(): MappableField[] {
  const carLabels = ptBRDataShapes.positionsEntryFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('sessionId', extraLabels.sessionId, true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    entryField('position', extraLabels.position, true),
    entryField('carNumber', carLabels.carNumber, true),
    entryField('teamName', carLabels.teamName, true),
    entryField('schoolName', carLabels.schoolName, true),
    entryField('laps', carLabels.laps, true),
    entryField('status', carLabels.status, true),
    entryField('lastLapMs', carLabels.lastLapMs, false),
    entryField('bestLapMs', carLabels.bestLapMs, false),
    entryField('gapToLeaderMs', carLabels.gapToLeaderMs, false),
    entryField('gapToLeaderLaps', carLabels.gapToLeaderLaps, false),
    entryField('intervalMs', carLabels.intervalMs, false),
    entryField('pitStops', carLabels.pitStops, false),
    entryField('fuelStops', carLabels.fuelStops, false),
  ];
}

/**
 * The standings' own fields, then the fields of each team. pointsByEvent is left out: a
 * table of points per event would be a second mapping inside each entry, and no source
 * sends one yet.
 */
function listStandingsFields(): MappableField[] {
  const teamLabels = ptBRDataShapes.standingsEntryFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('scope', ptBRDataShapes.standingsFieldLabels.scope, true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    entryField('rank', extraLabels.rank, true),
    entryField('carNumber', teamLabels.carNumber, true),
    entryField('teamName', teamLabels.teamName, true),
    entryField('schoolName', teamLabels.schoolName, true),
    entryField('points', teamLabels.points, true),
  ];
}
