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
      return listBracketsFields();
    case 'incidents':
      return listIncidentsFields();
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
    entryField('bestLapNumber', carLabels.bestLapNumber, false),
    entryField('gapToLeaderMs', carLabels.gapToLeaderMs, false),
    entryField('gapToLeaderLaps', carLabels.gapToLeaderLaps, false),
    entryField('intervalMs', carLabels.intervalMs, false),
    entryField('pitStops', carLabels.pitStops, false),
    entryField('fuelStops', carLabels.fuelStops, false),
    // Read only by the gaps step (workOutGapsFromLaps, gapsFromLaps.ts), then taken off.
    entryField('lastPassAtMs', extraLabels.lastPassAtMs, false),
  ];
}

/**
 * The standings' own fields, then the fields of each team, required first. A team's parts
 * of the score are one list per team, each part a label and a value
 * (standingsScorePartLists.ts); the standings' own `scoreParts` is built from those lists,
 * so it is not a field of its own. The rank is optional: a disqualified team has none.
 */
function listStandingsFields(): MappableField[] {
  const teamLabels = ptBRDataShapes.standingsEntryFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('scope', ptBRDataShapes.standingsFieldLabels.scope, true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    entryField('carNumber', teamLabels.carNumber, true),
    entryField('teamName', teamLabels.teamName, true),
    entryField('schoolName', teamLabels.schoolName, true),
    entryField('points', teamLabels.points, true),
    entryField('rank', extraLabels.rank, false),
    entryField('pointsByPart', extraLabels.pointsByPart, false),
    entryField('isDisqualified', extraLabels.isDisqualified, false),
  ];
}

/**
 * The brackets' own fields, then the fields of each match. A source lists its matches flat,
 * one element per match as the Baja app's `tournament` table does, and each names its round
 * (`roundName`, and `roundIsThirdPlace` for the third place); the mapping groups them into
 * rounds in the order met (bracketRoundsOfMappedMatches.ts). carB is all optional: a bye has
 * none (BAJAOVRLAY-25).
 */
function listBracketsFields(): MappableField[] {
  const matchLabels = ptBRFlexMapping.bracketsMatchFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('sessionId', extraLabels.sessionId, true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    entryField('roundName', matchLabels.roundName, true),
    entryField('matchId', matchLabels.matchId, true),
    entryField('carA.carNumber', matchLabels.carOfSlot('A', matchLabels.carNumber), true),
    entryField('carA.teamName', matchLabels.carOfSlot('A', matchLabels.teamName), true),
    entryField('carA.schoolName', matchLabels.carOfSlot('A', matchLabels.schoolName), true),
    entryField('roundIsThirdPlace', matchLabels.roundIsThirdPlace, false),
    entryField('bestOf', matchLabels.bestOf, false),
    entryField('walkover', matchLabels.walkover, false),
    entryField('winnerCarNumber', matchLabels.winnerCarNumber, false),
    entryField('carA.timeMs', matchLabels.carOfSlot('A', matchLabels.timeMs), false),
    entryField('carA.wins', matchLabels.carOfSlot('A', matchLabels.wins), false),
    entryField('carB.carNumber', matchLabels.carOfSlot('B', matchLabels.carNumber), false),
    entryField('carB.teamName', matchLabels.carOfSlot('B', matchLabels.teamName), false),
    entryField('carB.schoolName', matchLabels.carOfSlot('B', matchLabels.schoolName), false),
    entryField('carB.timeMs', matchLabels.carOfSlot('B', matchLabels.timeMs), false),
    entryField('carB.wins', matchLabels.carOfSlot('B', matchLabels.wins), false),
  ];
}

/**
 * The incidents' own fields, then the fields of each incident: what a source must send for
 * a penalty to reach the inbox, then what makes the notice richer (BAJAOVRLAY-44).
 */
function listIncidentsFields(): MappableField[] {
  const incidentLabels = ptBRDataShapes.incidentsEntryFieldLabels;
  const extraLabels = ptBRFlexMapping.extraFieldLabels;
  return [
    topLevelField('sessionId', extraLabels.sessionId, true),
    topLevelField('updatedAtMs', extraLabels.updatedAtMs, true),
    entryField('incidentId', incidentLabels.incidentId, true),
    entryField('carNumber', incidentLabels.carNumber, true),
    entryField('teamName', incidentLabels.teamName, true),
    entryField('schoolName', incidentLabels.schoolName, true),
    entryField('kind', incidentLabels.kind, true),
    entryField('reason', incidentLabels.reason, true),
    entryField('penaltyText', incidentLabels.penaltyText, false),
    entryField('lap', incidentLabels.lap, false),
    entryField('atMs', incidentLabels.atMs, false),
  ];
}
