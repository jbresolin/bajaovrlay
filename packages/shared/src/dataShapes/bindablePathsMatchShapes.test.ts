/**
 * Every bindable path names a real field of its shape (packages/shared)
 *
 * What this module is for:
 *   listBindablePathsOfShape is written by hand, so nothing but a test stops a path from
 *   naming a field the shape does not have ("entries.0.team" instead of "teamName"). Such
 *   a path would be offered in the picker and read nothing at the take.
 *
 * What these tests prove:
 *   - For each of the five shapes, every listed path leads to a field of the shape's Zod
 *     schema, a number stepping into a list's elements and `entryOfCar` standing for one
 *     element of `entries` (how a car chosen by number is read).
 *
 * What these tests deliberately do not cover:
 *   - The labels, types and order of the paths; bindablePaths.test.ts fixes them.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { listBindablePathsOfShape } from './bindablePaths.js';
import { BracketsShapeSchema } from './bracketsShape.js';
import type { DataShapeKey } from './dataShapeKey.js';
import { IncidentsShapeSchema } from './incidentsShape.js';
import { PositionsShapeSchema } from './positionsShape.js';
import { SessionShapeSchema } from './sessionShape.js';
import { StandingsShapeSchema } from './standingsShape.js';

const everyShapeScenarios: Array<{ name: string; shapeKey: DataShapeKey; schema: z.ZodType }> = [
  // The session, with the whole clock and the clock's own fields under `clock`.
  { name: 'the session', shapeKey: 'session', schema: SessionShapeSchema },
  // The positions, with the whole list, the car chosen by number and ten places.
  { name: 'the positions', shapeKey: 'positions', schema: PositionsShapeSchema },
  // The standings, with the scope, the whole list and ten rows.
  { name: 'the standings', shapeKey: 'standings', schema: StandingsShapeSchema },
  // The brackets, with the rounds only.
  { name: 'the brackets', shapeKey: 'brackets', schema: BracketsShapeSchema },
  // The incidents, with the whole list only.
  { name: 'the incidents', shapeKey: 'incidents', schema: IncidentsShapeSchema },
];

describe('listBindablePathsOfShape against the shape schemas', () => {
  it.each(everyShapeScenarios)(
    'names only fields that exist in the schema of $name',
    ({ shapeKey, schema }) => {
      // Arrange: the paths of this row's shape.
      const paths = listBindablePathsOfShape(shapeKey).map((bindablePath) => bindablePath.path);

      // Act: keep every path that does not lead to a field of the schema.
      const pathsLeadingNowhere = paths.filter(
        (path) => !doesPathLeadToAFieldOfSchema(schema, path),
      );

      // Assert: none; a mistyped path would bind to nothing and the field would be empty.
      expect(pathsLeadingNowhere, 'every path must lead to a field of its shape').toEqual([]);
    },
  );
});

/**
 * Walks a schema along a dot path and says whether it reaches a field. A number steps
 * into a list's elements, and `entryOfCar` stands for one element of `entries`. Optional
 * fields are unwrapped first.
 */
function doesPathLeadToAFieldOfSchema(schema: z.ZodType, path: string): boolean {
  let currentSchema: z.ZodType | undefined = schema;
  const steps = path.replace(/^entryOfCar\./, 'entries.0.').split('.');
  for (const step of steps) {
    currentSchema = unwrapOptional(currentSchema);
    if (currentSchema === undefined) {
      return false;
    }
    const isListIndex = /^\d+$/.test(step);
    if (isListIndex) {
      currentSchema =
        currentSchema instanceof z.ZodArray ? (currentSchema.element as z.ZodType) : undefined;
      continue;
    }
    currentSchema =
      currentSchema instanceof z.ZodObject
        ? (currentSchema.shape[step] as z.ZodType | undefined)
        : undefined;
  }
  return currentSchema !== undefined;
}

/** The schema inside an optional one, or the schema itself when it is not optional. */
function unwrapOptional(schema: z.ZodType | undefined): z.ZodType | undefined {
  if (schema instanceof z.ZodOptional) {
    return schema.unwrap() as z.ZodType;
  }
  return schema;
}
