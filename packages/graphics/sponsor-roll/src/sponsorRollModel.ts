/**
 * The sponsor roll's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, and the
 * pages the roll turns through (the kit's planSponsorPages: one level a page, six tiles on
 * the full screen; one sponsor a "page" in the corner). sponsor-roll.ograf.json describes
 * the same data as JSON Schema; sponsorRollManifestDataAgreement.test.ts keeps them in step.
 *
 * The sponsors are what an entity list of sponsors gives (BAJAOVRLAY-46): each with its
 * name, level, logo, plate choice and weight, sorted by the server; the roll pages them in
 * round order whatever the order they come in.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { planSponsorPages, type SponsorPage } from '@bajaovrlay/graphics-kit/sponsorPages';
import { sponsorLevelsInTheRound } from '@bajaovrlay/graphics-kit/sponsorRound';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The two layouts: the narrow board of tiles, or the bug's card in the corner. */
export const sponsorRollLayouts = ['fullscreen', 'corner'] as const;

/** One of the two layouts. */
export type SponsorRollLayout = (typeof sponsorRollLayouts)[number];

/** How many tiles a full-screen page holds (catalogue entry 11). */
export const tilesPerFullscreenPage = 6;

// One sponsor as the entity list of sponsors writes it. Strict, as the manifest's items are.
const sponsorRollSponsorSchema = z.strictObject({
  name: z.string().min(1),
  level: z.enum(sponsorLevelsInTheRound),
  logoUrl: z.string().min(1),
  logoOnLightPlate: z.boolean(),
  rollWeight: z.int().min(1).max(10),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const sponsorRollDataSchema = z.strictObject({
  layout: z.enum(sponsorRollLayouts),
  sponsors: z.array(sponsorRollSponsorSchema).min(1),
  eventWord: z.string().optional(),
});

const partialSponsorRollDataSchema = sponsorRollDataSchema.partial();

/** One sponsor of the roll. */
export type SponsorRollSponsor = z.infer<typeof sponsorRollSponsorSchema>;

/** Everything the sponsor roll shows, as the renderer sends it. */
export type SponsorRollData = z.infer<typeof sponsorRollDataSchema>;

/** One page of the roll: a level and its sponsors on that page. */
export type SponsorRollPage = SponsorPage<SponsorRollSponsor>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type SponsorRollDataCheck =
  { isValid: true; data: SponsorRollData } | { isValid: false; problem: string };

/**
 * The pages the roll turns through for its layout: up to six tiles of one level on the
 * full screen; one sponsor at a time in the corner, which the corner calls a page too.
 */
export function planSponsorRollPages(data: SponsorRollData): SponsorRollPage[] {
  const sponsorsPerPage = data.layout === 'fullscreen' ? tilesPerFullscreenPage : 1;
  return planSponsorPages(data.sponsors, sponsorsPerPage);
}

/**
 * Where the roll stands after its list changed on air: the same page when it still exists,
 * page 1 when the list shrank under it. The roll never jumps to a page that is not there.
 */
export function keepPageIndexWithin(pageIndex: number, pageCount: number): number {
  return pageIndex < pageCount ? pageIndex : 0;
}

/** Whether the corner shows the event word: only when it has something to show. */
export function hasEventWord(data: SponsorRollData): boolean {
  return isTextGiven(data.eventWord);
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteSponsorRollData(input: unknown): SponsorRollDataCheck {
  const parsed = sponsorRollDataSchema.safeParse(input);
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
export function mergePartialUpdateIntoSponsorRollData(
  currentData: SponsorRollData,
  partialInput: unknown,
): SponsorRollDataCheck {
  const parsedUpdate = partialSponsorRollDataSchema.safeParse(partialInput);
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
  return parseCompleteSponsorRollData({ ...currentData, ...parsedUpdate.data });
}
