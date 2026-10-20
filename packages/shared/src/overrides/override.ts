import { z } from 'zod';

/** Says whether an override was given any value at all (null counts as one). */
function isValuePresent(value: unknown): boolean {
  return value !== undefined;
}

/**
 * The session fields an operator may correct. The clock is left out on purpose: it is
 * four values that only mean something together, and a corrected time with the source's
 * moment would make the clock jump; a clock is corrected on air with "Edição rápida".
 */
export const OverridableSessionFieldSchema = z.enum([
  'eventName',
  'sessionName',
  'sessionKind',
  'state',
  'scheduledDurationMs',
  'lapsCompletedByLeader',
]);

/** One of OverridableSessionFieldSchema's values. */
export type OverridableSessionField = z.infer<typeof OverridableSessionFieldSchema>;

/**
 * The fields of one car an operator may correct: who the car is (team and school) and,
 * where the list has them, its status (positions) and its points (standings). Laps, times,
 * gaps and ranks are left out: one of them corrected alone would break the order the
 * shape's own rules keep, and the source is the one to fix them.
 */
export const OverridableCarFieldSchema = z.enum(['teamName', 'schoolName', 'status', 'points']);

/** One of OverridableCarFieldSchema's values. */
export type OverridableCarField = z.infer<typeof OverridableCarFieldSchema>;

/** What every override carries besides its key. */
const OverrideRecordSchema = z.object({
  /** The source whose data it corrects; every binding to that source sees the correction. */
  sourceId: z.string().min(1),
  /** The corrected value; it must fit the canonical field (checked by setOverride). */
  value: z.unknown().refine(isValuePresent, { message: 'an override needs a value' }),
  /** Why, in the operator's own words; required, so the next operator knows. */
  reason: z.string().trim().min(1),
  /** The actor that set it (operador:<connection id>). */
  setBy: z.string().min(1),
  /** When it was set, ISO 8601. */
  setAt: z.string().min(1),
});

/** A correction of one session field of one source. */
export const SessionFieldOverrideSchema = OverrideRecordSchema.extend({
  scope: z.literal('session'),
  field: OverridableSessionFieldSchema,
});

/**
 * A correction of one field of one car of one source. It applies to every entry of that
 * car, in the positions and in the standings, whatever its place: a correction for "the
 * third car" would follow the place and land on another team after the next pass, so
 * place-based corrections are not offered.
 */
export const CarFieldOverrideSchema = OverrideRecordSchema.extend({
  scope: z.literal('car'),
  carNumber: z.number().int().positive(),
  field: OverridableCarFieldSchema,
});

/**
 * One entry of the `overrides` slice (concept §4): an operator-typed value that wins over
 * the source until it is cleared, keyed by source, scope, field and, for a car, its number.
 */
export const OverrideSchema = z.discriminatedUnion('scope', [
  SessionFieldOverrideSchema,
  CarFieldOverrideSchema,
]);

/** An override that has passed OverrideSchema. */
export type Override = z.infer<typeof OverrideSchema>;
