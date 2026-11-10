/**
 * The plain sponsor roll's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, the corner
 * with its default, and the pass the data plans on shared's one table (sponsorRollPass.ts,
 * which the server's auto-out reads too). sponsor-roll-plain.ograf.json describes the same
 * data as JSON Schema; sponsorRollPlainManifestDataAgreement.test.ts keeps them in step.
 *
 * The sponsors are what an entity list of sponsors gives (each with its name, level, logo,
 * plate choice and weight). The logo is optional here, unlike the sponsor roll's: a list
 * typed by hand may hold a sponsor with no logo yet, and the pass skips it rather than
 * refusing the whole roll. The weight is accepted and not used: one pass shows each sponsor
 * once (weighting is out of the brief's scope).
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import {
  type ScreenCorner,
  ScreenCornerSchema,
} from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { sponsorLevelsInTheRound } from '@bajaovrlay/graphics-kit/sponsorRound';
import {
  type PlainSponsorRollPass,
  planPlainSponsorRollPass,
} from '@bajaovrlay/shared/sponsorRollPass';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** Top-left, the sponsor bug's corner, whose layer and footprint the roll takes. */
export const sponsorRollPlainDefaultCorner: ScreenCorner = 'top-left';

// One sponsor as the entity list of sponsors writes it. Strict, as the manifest's items are.
const plainRollSponsorSchema = z.strictObject({
  name: z.string().min(1),
  level: z.enum(sponsorLevelsInTheRound),
  logoUrl: z.string().optional(),
  logoOnLightPlate: z.boolean().optional(),
  rollWeight: z.int().min(1).max(10).optional(),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored. The
// corner is optional rather than `.default(...)`, so an update of the list alone never
// moves the card back to the default corner.
const sponsorRollPlainDataSchema = z.strictObject({
  sponsors: z.array(plainRollSponsorSchema).min(1),
  corner: ScreenCornerSchema.optional(),
});

const partialSponsorRollPlainDataSchema = sponsorRollPlainDataSchema.partial();

/** One sponsor of the roll. */
export type PlainRollSponsor = z.infer<typeof plainRollSponsorSchema>;

/** Everything the plain sponsor roll shows, as the renderer sends it. */
export type SponsorRollPlainData = z.infer<typeof sponsorRollPlainDataSchema>;

/** The pass of this roll's sponsors: who is shown, in order, and when each hold ends. */
export type SponsorRollPlainPass = PlainSponsorRollPass<PlainRollSponsor>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type SponsorRollPlainDataCheck =
  { isValid: true; data: SponsorRollPlainData } | { isValid: false; problem: string };

/** The corner the data asks for, the default when it names none. */
export function readSponsorRollPlainCorner(data: SponsorRollPlainData): ScreenCorner {
  return data.corner ?? sponsorRollPlainDefaultCorner;
}

/** The pass of the data's sponsors, planned on shared's table, as the server plans it. */
export function planThePassOfTheRoll(data: SponsorRollPlainData): SponsorRollPlainPass {
  return planPlainSponsorRollPass(data.sponsors);
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteSponsorRollPlainData(input: unknown): SponsorRollPlainDataCheck {
  const parsed = sponsorRollPlainDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives (the live refresh sends every sponsor
 * after an edit in Cadastros) into the current data, never modifying it.
 */
export function mergePartialUpdateIntoSponsorRollPlainData(
  currentData: SponsorRollPlainData,
  partialInput: unknown,
): SponsorRollPlainDataCheck {
  const parsedUpdate = partialSponsorRollPlainDataSchema.safeParse(partialInput);
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
  return parseCompleteSponsorRollPlainData({ ...currentData, ...parsedUpdate.data });
}
