/**
 * Which whole list fits a graphic's list field (packages/shared)
 *
 * What this module is for:
 *   A graphic's list field (the tower's cars, the standings' teams, the standings' score
 *   parts) is an `array` in its manifest, whose `items.required` names what each element
 *   must carry. A binding to a whole list of a source fits that field only when every
 *   element of the list always carries those keys; otherwise the take fails on the
 *   manifest's schema after the operator chose the binding (gate 2 of PR #25). The keys
 *   each list always carries are listed by hand, like the bindable paths.
 *
 * What these tests prove:
 *   - The keys listed for each whole list are exactly the keys its item schema requires,
 *     so the list cannot drift from the shapes.
 *   - The standings' score parts fit only a list field asking for partId and label (the
 *     standings' scoreParts), and no list of teams or cars.
 *   - The standings' teams fit the standings' entries but not the tower's, which asks for
 *     a position, laps and a status; the positions fit the tower's.
 *   - A list field that asks for nothing takes any whole list.
 *
 * What these tests deliberately do not cover:
 *   - The other value types and the clock group; bindingFitsGraphicField.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BracketRoundSchema } from '../dataShapes/bracketsShape.js';
import { IncidentEntrySchema } from '../dataShapes/incidentsShape.js';
import { PositionEntrySchema } from '../dataShapes/positionsShape.js';
import { StandingsEntrySchema, StandingsScorePartSchema } from '../dataShapes/standingsShape.js';
import { doesListFitArrayField, keysEveryItemOfTheListCarries } from './listItemKeys.js';

/** The keys an object schema refuses to go without, sorted. */
function listRequiredKeysOfSchema(objectSchema: z.ZodObject): string[] {
  return Object.entries(objectSchema.shape)
    .filter(([, fieldSchema]) => !fieldSchema.safeParse(undefined).success)
    .map(([fieldName]) => fieldName)
    .sort();
}

/** The tower's list field, as its manifest declares it. */
const towerEntriesField = {
  type: 'array',
  items: {
    type: 'object',
    required: ['position', 'carNumber', 'teamName', 'schoolName', 'laps', 'status'],
  },
};

/** The standings' list of teams, as its manifest declares it. */
const standingsEntriesField = {
  type: 'array',
  items: { type: 'object', required: ['carNumber', 'teamName', 'schoolName', 'points'] },
};

/** The standings' list of score parts, as its manifest declares it. */
const standingsScorePartsField = {
  type: 'array',
  items: { type: 'object', required: ['partId', 'label'] },
};

describe('keysEveryItemOfTheListCarries', () => {
  const listScenarios = [
    // A car of the positions.
    { listType: 'positionsEntries' as const, itemSchema: PositionEntrySchema },
    // A team of the standings: its rank is not among them, a disqualified team has none.
    { listType: 'standingsEntries' as const, itemSchema: StandingsEntrySchema },
    // A part of the score.
    { listType: 'standingsScoreParts' as const, itemSchema: StandingsScorePartSchema },
    // A round of the brackets.
    { listType: 'bracketsRounds' as const, itemSchema: BracketRoundSchema },
    // An incident.
    { listType: 'incidentsEntries' as const, itemSchema: IncidentEntrySchema },
  ];

  it.each(listScenarios)('lists exactly what $listType requires', ({ listType, itemSchema }) => {
    // Arrange: the item schema of the list.

    // Act: read the keys listed by hand.
    const keysListed = [...keysEveryItemOfTheListCarries[listType]].sort();

    // Assert: the same keys the schema requires.
    expect(keysListed, `${listType} must list what its items always carry`).toEqual(
      listRequiredKeysOfSchema(itemSchema),
    );
  });
});

describe('doesListFitArrayField', () => {
  const fitScenarios = [
    // The bug the review found: parts offered to the tower's cars.
    {
      name: 'the score parts do not fit the tower’s cars',
      listType: 'standingsScoreParts' as const,
      field: towerEntriesField,
      fits: false,
    },
    // Nor to the standings' teams.
    {
      name: 'the score parts do not fit the standings’ teams',
      listType: 'standingsScoreParts' as const,
      field: standingsEntriesField,
      fits: false,
    },
    // Their own field.
    {
      name: 'the score parts fit the standings’ score parts',
      listType: 'standingsScoreParts' as const,
      field: standingsScorePartsField,
      fits: true,
    },
    // The other way round: teams offered to the parts.
    {
      name: 'the standings’ teams do not fit the score parts',
      listType: 'standingsEntries' as const,
      field: standingsScorePartsField,
      fits: false,
    },
    // A team of the standings has no position, laps or status.
    {
      name: 'the standings’ teams do not fit the tower’s cars',
      listType: 'standingsEntries' as const,
      field: towerEntriesField,
      fits: false,
    },
    // Their own field.
    {
      name: 'the standings’ teams fit the standings’ teams',
      listType: 'standingsEntries' as const,
      field: standingsEntriesField,
      fits: true,
    },
    // The tower's own list.
    {
      name: 'the positions fit the tower’s cars',
      listType: 'positionsEntries' as const,
      field: towerEntriesField,
      fits: true,
    },
    // A list field with no requirement takes whatever list the operator picks.
    {
      name: 'any list fits a list field that asks for nothing',
      listType: 'bracketsRounds' as const,
      field: { type: 'array' },
      fits: true,
    },
  ];

  it.each(fitScenarios)('$name', ({ listType, field, fits }) => {
    // Arrange: the list and the field come from the row.

    // Act: ask whether the list fits.
    const doesItFit = doesListFitArrayField(listType, field);

    // Assert: as the row says.
    expect(doesItFit, `${listType} on this field`).toBe(fits);
  });
});
