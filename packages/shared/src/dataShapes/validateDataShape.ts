import type { z } from 'zod';

import { type BracketsShape, BracketsShapeSchema } from './bracketsShape.js';
import type { DataShapeKey } from './dataShapeKey.js';
import { type IncidentsShape, IncidentsShapeSchema } from './incidentsShape.js';
import { type PositionsShape, PositionsShapeSchema } from './positionsShape.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';
import { type SessionShape, SessionShapeSchema } from './sessionShape.js';
import { type StandingsShape, StandingsShapeSchema } from './standingsShape.js';
import { type SuperChatsShape, SuperChatsShapeSchema } from './superChatsShape.js';

/** Any one of the six canonical shapes, after validation. */
export type DataShape =
  SessionShape | PositionsShape | StandingsShape | BracketsShape | IncidentsShape | SuperChatsShape;

/** The answer of validateDataShape: the parsed shape, or one pt-BR sentence saying why not. */
export type DataShapeValidation =
  { isValid: true; shape: DataShape } | { isValid: false; errorMessage: string };

/**
 * Checks a payload a source produced against the canonical shape named by `shapeKey`.
 * On failure the message is pt-BR and names the path of the first bad field, starting
 * with the shape key: `Dados inválidos em "positions.entries.3.status": ...`.
 * Unknown extra fields are dropped from the parsed shape, not refused.
 */
export function validateDataShape(shapeKey: DataShapeKey, payload: unknown): DataShapeValidation {
  const result = parsePayloadForShape(shapeKey, payload);
  if (result.success) {
    return { isValid: true, shape: result.data };
  }

  // Only the first problem is named: the operator fixes one thing at a time, and a list of
  // sixty would hide the cause. The same reading the server uses for a refused command.
  const firstIssue = result.error.issues[0];
  const pathInsideShape = firstIssue?.path.map(String) ?? [];
  const fullPath = [shapeKey, ...pathInsideShape].join('.');
  const reason = firstIssue ? explainIssueInPortuguese(firstIssue) : '';
  return { isValid: false, errorMessage: ptBRDataShapes.invalidDataAtPath(fullPath, reason) };
}

/** Runs the one schema that belongs to `shapeKey`. */
function parsePayloadForShape(
  shapeKey: DataShapeKey,
  payload: unknown,
): z.ZodSafeParseResult<DataShape> {
  // reportInput keeps the refused value on each issue, so a missing field can be told
  // apart from a wrong one (see explainIssueInPortuguese).
  const parseOptions = { reportInput: true };
  switch (shapeKey) {
    case 'session':
      return SessionShapeSchema.safeParse(payload, parseOptions);
    case 'positions':
      return PositionsShapeSchema.safeParse(payload, parseOptions);
    case 'standings':
      return StandingsShapeSchema.safeParse(payload, parseOptions);
    case 'brackets':
      return BracketsShapeSchema.safeParse(payload, parseOptions);
    case 'incidents':
      return IncidentsShapeSchema.safeParse(payload, parseOptions);
    case 'superChats':
      return SuperChatsShapeSchema.safeParse(payload, parseOptions);
  }
}

/**
 * Turns one Zod issue into pt-BR words. Our own rules (custom issues) already carry a
 * pt-BR sentence from the catalog; Zod's built-in ones are in English, so they are named
 * by their kind instead, and a missing field is named as missing whatever its kind.
 */
function explainIssueInPortuguese(issue: z.core.$ZodIssue): string {
  const reasons = ptBRDataShapes.validationReasons;
  // A missing field checked against a list (a flag, a status, a scope) comes back from Zod
  // as "not one of the allowed values"; the operator must read that it is missing instead.
  const isFieldMissing = issue.code !== 'custom' && issue.input === undefined;
  if (isFieldMissing) {
    return reasons.wrongTypeOrMissing;
  }

  switch (issue.code) {
    case 'custom':
      return issue.message;
    case 'invalid_type':
      return reasons.wrongTypeOrMissing;
    case 'invalid_value':
    case 'invalid_union':
      return reasons.valueNotInList;
    case 'too_small':
      return reasons.valueTooSmall;
    case 'too_big':
      return reasons.valueTooBig;
    case 'invalid_format':
      return reasons.wrongFormat;
    default:
      return reasons.otherwiseWrong;
  }
}
