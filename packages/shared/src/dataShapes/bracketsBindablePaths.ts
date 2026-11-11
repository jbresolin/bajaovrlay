import type { BindablePath } from './bindablePaths.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/**
 * The first word of the paths that read the match in one slot of the match focus
 * (BAJAOVRLAY-65): "matchNow.carA.shortName" reads the short name of the first car of the
 * match "agora". The resolver strips it and reads the rest from the focused match.
 */
export const bracketMatchSlotPathPrefixes = {
  current: 'matchNow.',
  upNext: 'matchUpNext.',
} as const;

/** The fields of the focused match the picker offers, before its cars, with their types. */
const focusedMatchFieldTypes = [
  { fieldName: 'roundName', valueType: 'text' },
  { fieldName: 'isThirdPlace', valueType: 'boolean' },
  { fieldName: 'bestOf', valueType: 'integer' },
  { fieldName: 'winnerCarNumber', valueType: 'integer' },
] as const;

/** The fields of each car of the focused match, in the order the picker shows them. */
const focusedMatchCarFieldTypes = [
  { fieldName: 'carNumber', valueType: 'integer' },
  { fieldName: 'shortName', valueType: 'text' },
  { fieldName: 'teamName', valueType: 'text' },
  { fieldName: 'schoolName', valueType: 'text' },
  { fieldName: 'city', valueType: 'text' },
  { fieldName: 'state', valueType: 'text' },
  { fieldName: 'logoUrl', valueType: 'text' },
  { fieldName: 'logoOnLightPlate', valueType: 'boolean' },
  { fieldName: 'wins', valueType: 'integer' },
  { fieldName: 'timeMs', valueType: 'integer' },
] as const;

/** Joins label parts with the catalog's separator: "Chaves › Partida agora › Fase". */
function joinLabelParts(labelParts: string[]): string {
  return labelParts.join(ptBRDataShapes.labelSeparator);
}

/** The paths of one slot of the match focus: the match's fields, then carA's, then carB's. */
function listFocusedMatchPaths(slot: 'current' | 'upNext'): BindablePath[] {
  const labels = ptBRDataShapes.bracketMatchFocusLabels;
  const prefix = bracketMatchSlotPathPrefixes[slot];
  const labelStart = [ptBRDataShapes.shapeNames.brackets, labels.slotNames[slot]];
  const paths: BindablePath[] = [];
  for (const { fieldName, valueType } of focusedMatchFieldTypes) {
    paths.push({
      path: `${prefix}${fieldName}`,
      label: joinLabelParts([...labelStart, labels.matchFieldLabels[fieldName]]),
      valueType,
      isCarChosenByNumber: false,
      bracketMatchSlot: slot,
    });
  }
  for (const side of ['carA', 'carB'] as const) {
    for (const { fieldName, valueType } of focusedMatchCarFieldTypes) {
      paths.push({
        path: `${prefix}${side}.${fieldName}`,
        label: joinLabelParts([
          ...labelStart,
          labels.carNames[side],
          labels.carFieldLabels[fieldName],
        ]),
        valueType,
        isCarChosenByNumber: false,
        bracketMatchSlot: slot,
      });
    }
  }
  return paths;
}

/**
 * Brackets: the whole list of rounds, which the bracket graphic draws (BAJAOVRLAY-25),
 * then the match "agora" and the match "a seguir" field by field, which the match bug and
 * the "a seguir" card read (BAJAOVRLAY-65). Kept apart from bindablePaths.ts, which lists
 * the other shapes, for its size.
 */
export function listBracketsPaths(): BindablePath[] {
  const shapeName = ptBRDataShapes.shapeNames.brackets;
  return [
    {
      path: 'rounds',
      label: joinLabelParts([shapeName, ptBRDataShapes.bracketsFieldLabels.rounds]),
      valueType: 'bracketsRounds',
      isCarChosenByNumber: false,
    },
    ...listFocusedMatchPaths('current'),
    ...listFocusedMatchPaths('upNext'),
  ];
}
