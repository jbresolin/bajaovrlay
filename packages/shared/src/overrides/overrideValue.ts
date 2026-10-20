import type { z } from 'zod';

import { PositionEntrySchema } from '../dataShapes/positionsShape.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { SessionShapeSchema } from '../dataShapes/sessionShape.js';
import { StandingsEntrySchema } from '../dataShapes/standingsShape.js';
import { quoteValueForReason } from '../transforms/quoteValueForReason.js';
import type { OverridableCarField, OverridableSessionField } from './override.js';

/**
 * Says why a corrected value does not fit its field, as one pt-BR sentence naming the
 * field, or undefined when it fits. It reads the canonical shapes' own field schemas, so
 * a correction can only put on air what a source could have sent: a flag the graphics
 * know, a status of the list, a name that is not empty, points as a number.
 */
export function findProblemInOverrideValue(
  scope: 'session' | 'car',
  field: string,
  value: unknown,
): string | undefined {
  const fieldSchema =
    scope === 'session' ? findSessionFieldSchema(field) : findCarFieldSchema(field);
  if (fieldSchema?.safeParse(value).success === true) {
    return undefined;
  }
  return `O valor ${quoteValueForReason(value)} não serve para ${labelOfOverridableField(scope, field)}.`;
}

/**
 * The label of a correctable field as the operator reads it: "Sessão › Nome da sessão",
 * "Carro › Equipe".
 */
export function labelOfOverridableField(scope: 'session' | 'car', field: string): string {
  const separator = ptBRDataShapes.labelSeparator;
  if (scope === 'session') {
    const sessionLabels: Record<string, string> = ptBRDataShapes.sessionFieldLabels;
    return `${ptBRDataShapes.shapeNames.session}${separator}${sessionLabels[field] ?? field}`;
  }
  const carLabels: Record<string, string> = {
    ...ptBRDataShapes.positionsEntryFieldLabels,
    ...ptBRDataShapes.standingsEntryFieldLabels,
  };
  return `${ptBRDataShapes.carLabel}${separator}${carLabels[field] ?? field}`;
}

/** The session shape's schema of one correctable field. */
function findSessionFieldSchema(field: string): z.ZodType | undefined {
  const sessionFields: Record<OverridableSessionField, z.ZodType> = {
    eventName: SessionShapeSchema.shape.eventName,
    sessionName: SessionShapeSchema.shape.sessionName,
    sessionKind: SessionShapeSchema.shape.sessionKind,
    state: SessionShapeSchema.shape.state,
    scheduledDurationMs: SessionShapeSchema.shape.scheduledDurationMs.unwrap(),
    lapsCompletedByLeader: SessionShapeSchema.shape.lapsCompletedByLeader.unwrap(),
  };
  return Object.hasOwn(sessionFields, field)
    ? sessionFields[field as OverridableSessionField]
    : undefined;
}

/** A car entry's schema of one correctable field (team and school are in both lists). */
function findCarFieldSchema(field: string): z.ZodType | undefined {
  const carFields: Record<OverridableCarField, z.ZodType> = {
    teamName: PositionEntrySchema.shape.teamName,
    schoolName: PositionEntrySchema.shape.schoolName,
    status: PositionEntrySchema.shape.status,
    points: StandingsEntrySchema.shape.points,
  };
  return Object.hasOwn(carFields, field) ? carFields[field as OverridableCarField] : undefined;
}
