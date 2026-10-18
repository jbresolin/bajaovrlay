import type { DataShapeKey } from './dataShapeKey.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/** One path a binding may point at inside a shape, and the pt-BR label the picker shows. */
export type BindablePath = {
  /** Dot-separated, from the shape's root: "entries.0.teamName". */
  path: string;
  /** "Posições › 1º colocado › Equipe". */
  label: string;
};

/**
 * How many of the first entries of positions and standings get paths of their own (places
 * for positions, rows for standings, where tied teams share a rank). Ten covers a top-ten
 * graphic and a team card for the podium; a graphic that needs more takes the whole list
 * ("Lista completa").
 */
const firstEntriesWithTheirOwnPaths = 10;

/**
 * Lists the paths a binding may point at in one shape, with their pt-BR labels, in the
 * order the picker shows them. Written out by hand on purpose (readability law): deriving
 * it from the Zod schemas would need type-level code a reviewer has to run in their head,
 * and it would offer fields no graphic should show (ids, `updatedAtMs`).
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

/** Joins label parts with the catalog's separator: "Sessão › Bandeira". */
function joinLabelParts(labelParts: string[]): string {
  return labelParts.join(ptBRDataShapes.labelSeparator);
}

/** The session's fields, the clock field by field. */
function listSessionPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.session;
  const fieldLabels = ptBRDataShapes.sessionFieldLabels;
  const clockLabels = ptBRDataShapes.clockFieldLabels;
  return [
    { path: 'eventName', label: joinLabelParts([shapeName, fieldLabels.eventName]) },
    { path: 'sessionName', label: joinLabelParts([shapeName, fieldLabels.sessionName]) },
    { path: 'sessionKind', label: joinLabelParts([shapeName, fieldLabels.sessionKind]) },
    { path: 'state', label: joinLabelParts([shapeName, fieldLabels.state]) },
    {
      path: 'clock.clockMode',
      label: joinLabelParts([shapeName, fieldLabels.clock, clockLabels.clockMode]),
    },
    {
      path: 'clock.referenceTimeMs',
      label: joinLabelParts([shapeName, fieldLabels.clock, clockLabels.referenceTimeMs]),
    },
    {
      path: 'clock.referenceWallClockMs',
      label: joinLabelParts([shapeName, fieldLabels.clock, clockLabels.referenceWallClockMs]),
    },
    {
      path: 'clock.running',
      label: joinLabelParts([shapeName, fieldLabels.clock, clockLabels.running]),
    },
    {
      path: 'scheduledDurationMs',
      label: joinLabelParts([shapeName, fieldLabels.scheduledDurationMs]),
    },
    {
      path: 'lapsCompletedByLeader',
      label: joinLabelParts([shapeName, fieldLabels.lapsCompletedByLeader]),
    },
  ];
}

/** The fields of one car the picker offers per place, in the order it shows them. */
const positionsEntryFieldsPerPlace = [
  'carNumber',
  'teamName',
  'schoolName',
  'laps',
  'lastLapMs',
  'bestLapMs',
  'gapToLeaderMs',
  'gapToLeaderLaps',
  'intervalMs',
  'pitStops',
  'status',
] as const;

/** The whole list, then each of the first ten places field by field. */
function listPositionsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.positions;
  const paths: BindablePath[] = [
    { path: 'entries', label: joinLabelParts([shapeName, ptBRDataShapes.wholeListLabel]) },
  ];
  for (let index = 0; index < firstEntriesWithTheirOwnPaths; index += 1) {
    const placeLabel = ptBRDataShapes.placeLabel(index + 1);
    for (const fieldName of positionsEntryFieldsPerPlace) {
      const fieldLabel = ptBRDataShapes.positionsEntryFieldLabels[fieldName];
      paths.push({
        path: `entries.${index}.${fieldName}`,
        label: joinLabelParts([shapeName, placeLabel, fieldLabel]),
      });
    }
  }
  return paths;
}

/** The fields of one team the picker offers per row, in the order it shows them. */
const standingsEntryFieldsPerRow = ['carNumber', 'teamName', 'schoolName', 'points'] as const;

/**
 * The scope, the whole list, then each of the first ten rows field by field. Labelled by
 * row ("1ª linha"), not by place: tied teams share a rank, so a row's index is not its
 * place. Picking a team by its car number is BAJAOVRLAY-20's to add.
 */
function listStandingsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.standings;
  const paths: BindablePath[] = [
    {
      path: 'scope',
      label: joinLabelParts([shapeName, ptBRDataShapes.standingsFieldLabels.scope]),
    },
    { path: 'entries', label: joinLabelParts([shapeName, ptBRDataShapes.wholeListLabel]) },
  ];
  for (let index = 0; index < firstEntriesWithTheirOwnPaths; index += 1) {
    const rowLabel = ptBRDataShapes.rowLabel(index + 1);
    for (const fieldName of standingsEntryFieldsPerRow) {
      const fieldLabel = ptBRDataShapes.standingsEntryFieldLabels[fieldName];
      paths.push({
        path: `entries.${index}.${fieldName}`,
        label: joinLabelParts([shapeName, rowLabel, fieldLabel]),
      });
    }
  }
  return paths;
}

/** Brackets are a draft (BAJAOVRLAY-25): only the whole list of rounds for now. */
function listBracketsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.brackets;
  return [
    {
      path: 'rounds',
      label: joinLabelParts([shapeName, ptBRDataShapes.bracketsFieldLabels.rounds]),
    },
  ];
}
