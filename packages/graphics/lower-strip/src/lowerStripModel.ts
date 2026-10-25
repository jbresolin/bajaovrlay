/**
 * The lower strip's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * lower-strip.ograf.json describes the same data as JSON Schema for renderers and forms;
 * lowerStripManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * Three groups of fields: the running order (`entries`, bound live to the positions, as
 * the tower's are), the clock (the race clock's four clock fields, known by role, and the
 * flag; the kit's, so the item editor's "Relógio da fonte" and the server's
 * carryClockForward treat them as a clock), and the clock block's switch. The clock fields
 * are required with typed defaults, as the race clock's are, even with the block off: the
 * conservative choice, which keeps every strip a complete clock.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { raceClockReadingFieldSchemas } from '@bajaovrlay/graphics-kit/raceClockReading';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// One car of the running order: what the strip draws, and every other field of the
// positions entry let through (the source sends laps, gaps, status… which the strip
// ignores), so a whole list bound from the positions fits as it comes.
const stripCarSchema = z.looseObject({
  position: z.int().min(1),
  carNumber: z.int().min(1),
  schoolName: z.string(),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// The switch is optional rather than `.default(true)`, so an update that only changes the
// cars never turns the block back on; isClockBlockShown reads the default.
const lowerStripDataSchema = z.strictObject({
  entries: z.array(stripCarSchema),
  ...raceClockReadingFieldSchemas,
  showClockBlock: z.boolean().optional(),
});

const partialLowerStripDataSchema = lowerStripDataSchema.partial();

/** Everything the lower strip shows, as the renderer sends it. */
export type LowerStripData = z.infer<typeof lowerStripDataSchema>;

/** One car of the running order, as the strip reads it. */
export type StripCar = z.infer<typeof stripCarSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type LowerStripDataCheck =
  { isValid: true; data: LowerStripData } | { isValid: false; problem: string };

/** Whether the clock block is shown; a missing switch means shown, the everyday look. */
export function isClockBlockShown(data: LowerStripData): boolean {
  return data.showClockBlock ?? true;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteLowerStripData(input: unknown): LowerStripDataCheck {
  const parsed = lowerStripDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied. A new `entries`
 * replaces the whole list, as the live binding sends it.
 */
export function mergePartialUpdateIntoLowerStripData(
  currentData: LowerStripData,
  partialInput: unknown,
): LowerStripDataCheck {
  const parsedUpdate = partialLowerStripDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(
        partialInput,
        parsedUpdate.error,
        ptBR.validationProblems,
      ),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteLowerStripData(mergedData);
}
