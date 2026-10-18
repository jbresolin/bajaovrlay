// Checking the shapes of a good poll against the canonical shapes, all or nothing.
import {
  DataShapeKeySchema,
  type DataSnapshotShapes,
  DataSnapshotShapesSchema,
  validateDataShape,
} from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The answer of validatePolledShapes: every shape typed, or why the poll is a failure. */
export type PolledShapesValidation =
  { isValid: true; shapes: DataSnapshotShapes } | { isValid: false; errorMessage: string };

/**
 * Checks every shape a poll produced. A poll never half-succeeds: one bad shape, or one
 * name that is none of the four canonical shapes, makes the whole poll a failure, and the
 * pt-BR message names the path of the first problem (validateDataShape's sentence). A
 * poll with no shape at all is a failure too: storing it would blank the last good data.
 */
export function validatePolledShapes(rawShapes: Record<string, unknown>): PolledShapesValidation {
  const isEmptyAnswer = Object.keys(rawShapes).length === 0;
  if (isEmptyAnswer) {
    return { isValid: false, errorMessage: ptBR.dataSourceErrors.noShapesInPoll };
  }

  for (const [shapeName, payload] of Object.entries(rawShapes)) {
    const shapeKeyCheck = DataShapeKeySchema.safeParse(shapeName);
    if (!shapeKeyCheck.success) {
      return { isValid: false, errorMessage: ptBR.dataSourceErrors.unknownShapeKey(shapeName) };
    }
    const shapeValidation = validateDataShape(shapeKeyCheck.data, payload);
    if (!shapeValidation.isValid) {
      return { isValid: false, errorMessage: shapeValidation.errorMessage };
    }
  }

  // Every shape has just passed its own schema, so this parse cannot fail: it is here to
  // hand back the shapes typed by name, which validateDataShape's answer is not.
  return { isValid: true, shapes: DataSnapshotShapesSchema.parse(rawShapes) };
}
