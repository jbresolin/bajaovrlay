/**
 * The lower third's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * lower-third.ograf.json describes the same data as JSON Schema for renderers and forms;
 * lowerThirdManifestDataAgreement.test.ts keeps the two in agreement.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// At least one character that is not a blank. The same rule is the manifest's
// `"pattern": "\\S"`, so the form and the graphic refuse the same names: a name of spaces
// would put an empty pill on air, which is exactly what the lower third must never show.
const somethingVisiblePattern = /\S/;

/**
 * Where the lower third sits along the bottom of the stage ("Posição", BAJAOVRLAY-85):
 * the pills' left edges at x 96, both pills centred on x 960, or their right edges at
 * x 1824. The same three values are the manifest's `enum` for "position".
 */
export const lowerThirdPositions = ['left', 'center', 'right'] as const;

/** One of the three places along the bottom: `left`, `center` or `right`. */
export type LowerThirdPosition = (typeof lowerThirdPositions)[number];

/**
 * The place of an item that does not say: the left, as every lower third was drawn
 * before the setting existed, so an item saved before BAJAOVRLAY-85 looks the same.
 */
export const defaultLowerThirdPosition: LowerThirdPosition = 'left';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// Only the name is required: the role and the team line are left out of the role pill
// when missing, and with neither the role pill itself is left out. A missing position
// is the left (defaultLowerThirdPosition).
const lowerThirdDataSchema = z.strictObject({
  name: z.string().regex(somethingVisiblePattern),
  role: z.string().optional(),
  teamLine: z.string().optional(),
  position: z.enum(lowerThirdPositions).optional(),
});

const partialLowerThirdDataSchema = lowerThirdDataSchema.partial();

/** Everything the lower third shows, as the renderer sends it. */
export type LowerThirdData = z.infer<typeof lowerThirdDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type LowerThirdDataCheck =
  { isValid: true; data: LowerThirdData } | { isValid: false; problem: string };

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteLowerThirdData(input: unknown): LowerThirdDataCheck {
  const parsed = lowerThirdDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. A field sent
 * as `undefined` is cleared: that is how the renderer says an operator emptied it. The
 * current data is never modified, so a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoLowerThirdData(
  currentData: LowerThirdData,
  partialInput: unknown,
): LowerThirdDataCheck {
  const parsedUpdate = partialLowerThirdDataSchema.safeParse(partialInput);
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
  return parseCompleteLowerThirdData(mergedData);
}

/** The place the data asks for, or the left when it does not say (or the field was cleared). */
export function choosePositionOfLowerThird(data: LowerThirdData): LowerThirdPosition {
  return data.position ?? defaultLowerThirdPosition;
}
