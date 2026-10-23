import { z } from 'zod';

import { mediaIdPattern } from '../media/mediaId.js';
import { ptBREntities } from './ptBREntities.js';

// The field schemas the four records share, each refusing with a pt-BR sentence that
// names the field (ptBREntities.recordProblems), because the CSV preview and the
// Cadastros form show Zod's message as it is.

const problems = ptBREntities.recordProblems;

/**
 * A text the record needs: trimmed (a CSV cell carries spaces), not blank, and at most
 * `maximumLength` characters, so a cell pasted with a whole paragraph is refused.
 */
export function buildRequiredTextSchema(fieldLabel: string, maximumLength: number) {
  const requiredMessage = problems.required(fieldLabel);
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(1, { error: requiredMessage })
    .max(maximumLength, { error: problems.tooLong(fieldLabel, maximumLength) });
}

/**
 * A text the record may leave out. Blank is not "left out" here: the form and the CSV
 * reader leave the key out for an empty cell, so a blank that reaches the schema is refused.
 */
export function buildOptionalTextSchema(fieldLabel: string, maximumLength: number) {
  return buildRequiredTextSchema(fieldLabel, maximumLength).optional();
}

/** A car number: a whole number from 1, the rule of the positions shape's carNumber. */
export function buildCarNumberSchema(fieldLabel: string) {
  const message = problems.wholeNumberFromOne(fieldLabel);
  return z.number({ error: message }).int({ error: message }).positive({ error: message });
}

/**
 * The id of a person, sponsor or schedule slot. The page makes one for a new record
 * (crypto.randomUUID), and a CSV may carry its own ("narrador-joao"), so an exported file
 * imported again updates the same records instead of adding copies.
 */
export function buildRecordIdSchema(fieldLabel: string) {
  return buildRequiredTextSchema(fieldLabel, 64);
}

/** An image of the media store (a logo, a photo), named by its media id; optional. */
export function buildOptionalMediaIdSchema(fieldLabel: string) {
  const message = problems.notAMediaId(fieldLabel);
  return z.string({ error: message }).regex(mediaIdPattern, { error: message }).optional();
}

/** A moment in ms since 1970 (a whole number), as every moment in the shapes. */
export function buildMomentSchema(fieldLabel: string) {
  const message = problems.momentInMilliseconds(fieldLabel);
  return z.number({ error: message }).int({ error: message });
}
