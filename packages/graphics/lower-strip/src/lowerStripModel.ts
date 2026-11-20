/**
 * The lower strip's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * lower-strip.ograf.json describes the same data as JSON Schema for renderers and forms;
 * lowerStripManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * Four groups of fields: the running order (`entries`, bound live to the positions, as
 * the tower's are), the clock (the race clock's four clock fields, known by role, and the
 * flag; the kit's, so the item editor's "Relógio da fonte" and the server's
 * carryClockForward treat them as a clock), the clock block's switch, and the two choices
 * of what else each car shows (BAJAOVRLAY-81: its laps, and its gap to the leader). The
 * four clock fields are required with typed defaults, as the race clock's are, even with
 * the block off: the conservative choice, which keeps every strip a complete clock. The
 * flag is optional (BAJAOVRLAY-81): with none, the block shows its time without the pill.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { raceClockReadingFieldSchemas } from '@bajaovrlay/graphics-kit/raceClockReading';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/**
 * The ways a car's gap to the leader can show (BAJAOVRLAY-81), read from the positions
 * entry's two canonical gap fields (a car carries one or the other, never both):
 * - `none`: no gap (the default, so the strips made before keep their look);
 * - `laps`: only a lapped car's laps behind ("+2 voltas"); a car on the leader's lap shows
 *   nothing, never "+0 voltas";
 * - `lapsAndTime`: whichever the car has, laps when lapped, the time on the leader's lap
 *   ("+12,3"), as the tower's DIF. column;
 * - `time`: only the time on the leader's lap; a lapped car has no time gap, so nothing.
 */
export const stripGapDisplays = ['none', 'laps', 'lapsAndTime', 'time'] as const;

/** One of stripGapDisplays. */
export type StripGapDisplay = (typeof stripGapDisplays)[number];

// One car of the running order: what the strip draws, and every other field of the
// positions entry let through (the source sends status, lap times… which the strip
// ignores), so a whole list bound from the positions fits as it comes.
//
// The laps and the two gaps (BAJAOVRLAY-81) are lenient on purpose: before they existed
// the strip let any value through in those fields, so a typed list or an odd source that
// sends, say, `gapToLeaderLaps: 0` or a fractional gap must not get its whole update
// refused now. A value outside the canonical positions shape's limits (a lapped car is at
// least one lap down; times and laps are whole numbers from 0) is read as absent, so only
// that one cell stays blank. The manifest leaves them undeclared (let through by
// `additionalProperties`) for the same reason.
const stripCarSchema = z.looseObject({
  position: z.int().min(1),
  carNumber: z.int().min(1),
  schoolName: z.string(),
  laps: z.int().min(0).optional().catch(undefined),
  gapToLeaderMs: z.int().min(0).optional().catch(undefined),
  gapToLeaderLaps: z.int().min(1).optional().catch(undefined),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// The switches are optional rather than `.default(...)`, so an update that only changes
// the cars never turns one back to its default; readStripCarColumns and isClockBlockShown
// read the defaults.
const lowerStripDataSchema = z.strictObject({
  entries: z.array(stripCarSchema),
  ...raceClockReadingFieldSchemas,
  showClockBlock: z.boolean().optional(),
  showLaps: z.boolean().optional(),
  gapDisplay: z.enum(stripGapDisplays).optional(),
});

const partialLowerStripDataSchema = lowerStripDataSchema.partial();

/** Everything the lower strip shows, as the renderer sends it. */
export type LowerStripData = z.infer<typeof lowerStripDataSchema>;

/** One car of the running order, as the strip reads it. */
export type StripCar = z.infer<typeof stripCarSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type LowerStripDataCheck =
  { isValid: true; data: LowerStripData } | { isValid: false; problem: string };

/** What each car shows beyond its position, number and school (BAJAOVRLAY-81). */
export type StripCarColumns = {
  /** Whether each car shows its laps ("43 voltas"). */
  isLapsShown: boolean;
  /** How each car shows its gap to the leader. */
  gapDisplay: StripGapDisplay;
};

/**
 * Reads what each car shows, the defaults applied: no laps and no gap, so a strip whose
 * item never set them looks exactly as it did before BAJAOVRLAY-81.
 */
export function readStripCarColumns(data: LowerStripData): StripCarColumns {
  return {
    isLapsShown: data.showLaps ?? false,
    gapDisplay: data.gapDisplay ?? 'none',
  };
}

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
