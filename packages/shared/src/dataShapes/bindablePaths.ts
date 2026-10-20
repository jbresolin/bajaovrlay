import { z } from 'zod';

import type { DataShapeKey } from './dataShapeKey.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/**
 * The kind of value found at a bindable path. The item editor offers a path to a field
 * only when its type fits the field (bindingFitsGraphicField.ts), and a binding
 * transform says which types it reads and which it gives.
 * - `text`, `integer`, `number`, `boolean`: one plain value.
 * - `stateEnum`: the session flag, exactly the race clock's flag values.
 * - `positionsEntries`, `standingsEntries`, `bracketsRounds`: a whole list, for a tower,
 *   a standings table or a bracket.
 * - `clockGroup`: the whole session clock, which fills a graphic's four clock fields at
 *   once (the clock group, concept §5), so the clock never jumps between two of them.
 */
export const BindableValueTypeSchema = z.enum([
  'text',
  'integer',
  'number',
  'boolean',
  'stateEnum',
  'positionsEntries',
  'standingsEntries',
  'bracketsRounds',
  'clockGroup',
]);

/** One of BindableValueTypeSchema's values. */
export type BindableValueType = z.infer<typeof BindableValueTypeSchema>;

/** One path a binding may point at inside a shape, and what the picker shows for it. */
export type BindablePath = {
  /** Dot-separated, from the shape's root: "entries.0.teamName", "entryOfCar.laps". */
  path: string;
  /** "Posições › 1º colocado › Equipe". */
  label: string;
  /** What is found there, so the picker offers it only to a field it fits. */
  valueType: BindableValueType;
  /**
   * True for the paths under `entryOfCar`, which read the car whose number the binding
   * names (`carNumber`) wherever it is in the list, instead of a fixed place.
   */
  isCarChosenByNumber: boolean;
};

/**
 * How many of the first entries of positions and standings get paths of their own (places
 * for positions, rows for standings, where tied teams share a rank). Ten covers a top-ten
 * graphic and a team card for the podium; a graphic that needs more takes the whole list
 * ("Lista completa").
 */
const firstEntriesWithTheirOwnPaths = 10;

/**
 * The word that starts every path reading the car the binding names by number. Written
 * as a path form with one parameter (the binding's `carNumber`) rather than one path per
 * car, so the list stays short and no query language is needed (brief B).
 */
export const entryOfCarPathPrefix = 'entryOfCar.';

/**
 * The session path of the whole clock, the clock group: one binding that fills a
 * graphic's four clock fields at once. Every check of "is this the whole clock" compares
 * with this one name (gate 2 of PR #18).
 */
export const wholeClockBindingPath = 'clock';

/**
 * Lists the paths a binding may point at in one shape, with their pt-BR labels and value
 * types, in the order the picker shows them. Written out by hand on purpose (readability
 * law): deriving it from the Zod schemas would need type-level code a reviewer has to run
 * in their head, and it would offer fields no graphic should show (ids, `updatedAtMs`).
 */
export function listBindablePathsOfShape(shapeKey: DataShapeKey): BindablePath[] {
  switch (shapeKey) {
    case 'session':
      return listSessionPaths();
    case 'positions':
      return listPositionsPaths();
    case 'standings':
      return listStandingsPaths();
    case 'brackets':
      return listBracketsPaths();
  }
}

/** The listed entry of this path in this shape, or undefined when the path is not listed. */
export function findBindablePath(shapeKey: DataShapeKey, path: string): BindablePath | undefined {
  return listBindablePathsOfShape(shapeKey).find((bindablePath) => bindablePath.path === path);
}

/** Joins label parts with the catalog's separator: "Sessão › Bandeira". */
function joinLabelParts(labelParts: string[]): string {
  return labelParts.join(ptBRDataShapes.labelSeparator);
}

/** A path read at a fixed place, or a top-level field; never chosen by car number. */
function buildPathAtFixedPlace(
  path: string,
  labelParts: string[],
  valueType: BindableValueType,
): BindablePath {
  return { path, label: joinLabelParts(labelParts), valueType, isCarChosenByNumber: false };
}

/** The session's fields: the whole clock first, then the clock field by field. */
function listSessionPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.session;
  const fieldLabels = ptBRDataShapes.sessionFieldLabels;
  const clockLabels = ptBRDataShapes.clockFieldLabels;
  return [
    buildPathAtFixedPlace('eventName', [shapeName, fieldLabels.eventName], 'text'),
    buildPathAtFixedPlace('sessionName', [shapeName, fieldLabels.sessionName], 'text'),
    buildPathAtFixedPlace('sessionKind', [shapeName, fieldLabels.sessionKind], 'text'),
    buildPathAtFixedPlace('state', [shapeName, fieldLabels.state], 'stateEnum'),
    buildPathAtFixedPlace(wholeClockBindingPath, [shapeName, fieldLabels.wholeClock], 'clockGroup'),
    buildPathAtFixedPlace(
      'clock.clockMode',
      [shapeName, fieldLabels.clock, clockLabels.clockMode],
      'text',
    ),
    buildPathAtFixedPlace(
      'clock.referenceTimeMs',
      [shapeName, fieldLabels.clock, clockLabels.referenceTimeMs],
      'integer',
    ),
    buildPathAtFixedPlace(
      'clock.referenceWallClockMs',
      [shapeName, fieldLabels.clock, clockLabels.referenceWallClockMs],
      'integer',
    ),
    buildPathAtFixedPlace(
      'clock.running',
      [shapeName, fieldLabels.clock, clockLabels.running],
      'boolean',
    ),
    buildPathAtFixedPlace(
      'scheduledDurationMs',
      [shapeName, fieldLabels.scheduledDurationMs],
      'integer',
    ),
    buildPathAtFixedPlace(
      'lapsCompletedByLeader',
      [shapeName, fieldLabels.lapsCompletedByLeader],
      'integer',
    ),
  ];
}

/** The fields of one car the picker offers, in the order it shows them, with their types. */
const positionsEntryFieldTypes = [
  { fieldName: 'carNumber', valueType: 'integer' },
  { fieldName: 'teamName', valueType: 'text' },
  { fieldName: 'schoolName', valueType: 'text' },
  { fieldName: 'laps', valueType: 'integer' },
  { fieldName: 'lastLapMs', valueType: 'integer' },
  { fieldName: 'bestLapMs', valueType: 'integer' },
  { fieldName: 'gapToLeaderMs', valueType: 'integer' },
  { fieldName: 'gapToLeaderLaps', valueType: 'integer' },
  { fieldName: 'intervalMs', valueType: 'integer' },
  { fieldName: 'pitStops', valueType: 'integer' },
  { fieldName: 'status', valueType: 'text' },
] as const;

/** The whole list, then the car chosen by number, then each of the first ten places. */
function listPositionsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.positions;
  const paths: BindablePath[] = [
    buildPathAtFixedPlace(
      'entries',
      [shapeName, ptBRDataShapes.wholeListLabel],
      'positionsEntries',
    ),
  ];
  for (const { fieldName, valueType } of positionsEntryFieldTypes) {
    const fieldLabel = ptBRDataShapes.positionsEntryFieldLabels[fieldName];
    paths.push({
      path: `${entryOfCarPathPrefix}${fieldName}`,
      label: joinLabelParts([shapeName, ptBRDataShapes.carChosenByNumberLabel, fieldLabel]),
      valueType,
      isCarChosenByNumber: true,
    });
  }
  for (let index = 0; index < firstEntriesWithTheirOwnPaths; index += 1) {
    const placeLabel = ptBRDataShapes.placeLabel(index + 1);
    for (const { fieldName, valueType } of positionsEntryFieldTypes) {
      const fieldLabel = ptBRDataShapes.positionsEntryFieldLabels[fieldName];
      paths.push(
        buildPathAtFixedPlace(
          `entries.${index}.${fieldName}`,
          [shapeName, placeLabel, fieldLabel],
          valueType,
        ),
      );
    }
  }
  return paths;
}

/** The fields of one team the picker offers per row, in the order it shows them. */
const standingsEntryFieldTypes = [
  { fieldName: 'carNumber', valueType: 'integer' },
  { fieldName: 'teamName', valueType: 'text' },
  { fieldName: 'schoolName', valueType: 'text' },
  { fieldName: 'points', valueType: 'number' },
] as const;

/**
 * The scope, the whole list, then each of the first ten rows field by field. Labelled by
 * row ("1ª linha"), not by place: tied teams share a rank, so a row's index is not its
 * place. A team chosen by its car number is offered in the positions only (brief B).
 */
function listStandingsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.standings;
  const paths: BindablePath[] = [
    buildPathAtFixedPlace('scope', [shapeName, ptBRDataShapes.standingsFieldLabels.scope], 'text'),
    buildPathAtFixedPlace(
      'entries',
      [shapeName, ptBRDataShapes.wholeListLabel],
      'standingsEntries',
    ),
  ];
  for (let index = 0; index < firstEntriesWithTheirOwnPaths; index += 1) {
    const rowLabel = ptBRDataShapes.rowLabel(index + 1);
    for (const { fieldName, valueType } of standingsEntryFieldTypes) {
      const fieldLabel = ptBRDataShapes.standingsEntryFieldLabels[fieldName];
      paths.push(
        buildPathAtFixedPlace(
          `entries.${index}.${fieldName}`,
          [shapeName, rowLabel, fieldLabel],
          valueType,
        ),
      );
    }
  }
  return paths;
}

/** Brackets are a draft (BAJAOVRLAY-25): only the whole list of rounds for now. */
function listBracketsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.brackets;
  return [
    buildPathAtFixedPlace(
      'rounds',
      [shapeName, ptBRDataShapes.bracketsFieldLabels.rounds],
      'bracketsRounds',
    ),
  ];
}
