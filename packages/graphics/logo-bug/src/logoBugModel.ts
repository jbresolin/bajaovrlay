/**
 * The logo bug's data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, pt-BR descriptions of bad data, and the look the data asks
 * for with the defaults filled in. logo-bug.ograf.json describes the same data as JSON
 * Schema for renderers and the item form; logoBugManifestDataAgreement.test.ts keeps the
 * two in agreement, and logoBugManifest.test.ts keeps the defaults below equal to the
 * manifest's.
 *
 * The logo is the one required field: a logo bug without an image has nothing to show, so
 * the item form refuses it before the take and load refuses it after. The corner, the
 * height and the opacity are optional rather than `.default(...)`, for the team card's
 * reason: a default inside the schema would be filled into every partial update, and an
 * update that only moved the corner would put the height back to 80 px. readLogoBugLook
 * reads the defaults.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import {
  type ScreenCorner,
  ScreenCornerSchema,
} from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The brief's defaults: bottom-right, 80 px high, fully opaque. */
export const logoBugDefaults = {
  corner: 'bottom-right',
  heightPx: 80,
  opacityPercent: 100,
} as const satisfies { corner: ScreenCorner; heightPx: number; opacityPercent: number };

/** The brief's limits: a height from 32 to 200 px, an opacity from 30% to 100%. */
export const logoBugLimits = {
  smallestHeightPx: 32,
  largestHeightPx: 200,
  faintestOpacityPercent: 30,
  fullOpacityPercent: 100,
} as const;

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const logoBugDataSchema = z.strictObject({
  logoUrl: z.string().min(1),
  corner: ScreenCornerSchema.optional(),
  heightPx: z
    .number()
    .int()
    .min(logoBugLimits.smallestHeightPx)
    .max(logoBugLimits.largestHeightPx)
    .optional(),
  opacityPercent: z
    .number()
    .int()
    .min(logoBugLimits.faintestOpacityPercent)
    .max(logoBugLimits.fullOpacityPercent)
    .optional(),
});

const partialLogoBugDataSchema = logoBugDataSchema.partial();

/** Everything the logo bug shows, as the renderer sends it. */
export type LogoBugData = z.infer<typeof logoBugDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type LogoBugDataCheck =
  { isValid: true; data: LogoBugData } | { isValid: false; problem: string };

/** The look the data asks for, every default filled in; the opacity as CSS wants it, 0..1. */
export type LogoBugLook = {
  logoUrl: string;
  corner: ScreenCorner;
  heightPx: number;
  opacity: number;
};

/** Reads the corner, the height and the opacity from the data, the brief's default for each one left out. */
export function readLogoBugLook(data: LogoBugData): LogoBugLook {
  const opacityPercent = data.opacityPercent ?? logoBugDefaults.opacityPercent;
  return {
    logoUrl: data.logoUrl,
    corner: data.corner ?? logoBugDefaults.corner,
    heightPx: data.heightPx ?? logoBugDefaults.heightPx,
    opacity: opacityPercent / 100,
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteLogoBugData(input: unknown): LogoBugDataCheck {
  const parsed = logoBugDataSchema.safeParse(input);
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
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoLogoBugData(
  currentData: LogoBugData,
  partialInput: unknown,
): LogoBugDataCheck {
  const parsedUpdate = partialLogoBugDataSchema.safeParse(partialInput);
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
  return parseCompleteLogoBugData(mergedData);
}
