/**
 * The sponsor bug's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, and what
 * the card is made of for given data: the event word and the sponsor cell, each only when
 * it has something to show. sponsor-bug.ograf.json describes the same data as JSON Schema
 * for renderers and forms; sponsorBugManifestDataAgreement.test.ts keeps the two in
 * agreement.
 *
 * The typical item reads the sponsor's logo and plate choice from Cadastros (the sponsor's
 * `logoUrl` and `logoOnLightPlate` attributes, BAJAOVRLAY-23) into `sponsorLogoUrl` and
 * `sponsorLogoOnLightPlate`. The names say "sponsor" because the card also carries the
 * Baja SAE Brasil mark, which is the theme's and never data.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// Every field is optional: the bug with nothing but the mark is a finished card. The plate
// is optional rather than `.default(false)`, for the team card's reason: a default inside
// the schema would be filled into every partial update, and an update that only changed
// the event word would take the sponsor's logo off its plate. isSponsorLogoOnLightPlate
// reads the default.
const sponsorBugDataSchema = z.strictObject({
  eventWord: z.string().optional(),
  caption: z.string().optional(),
  sponsorLogoUrl: z.string().optional(),
  sponsorLogoOnLightPlate: z.boolean().optional(),
});

const partialSponsorBugDataSchema = sponsorBugDataSchema.partial();

/** Everything the sponsor bug shows, as the renderer sends it. */
export type SponsorBugData = z.infer<typeof sponsorBugDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type SponsorBugDataCheck =
  { isValid: true; data: SponsorBugData } | { isValid: false; problem: string };

/** What the card is made of for given data, besides the mark, which is always there. */
export type SponsorBugCells = {
  /** The event word ("ENDURO") beside the mark. */
  hasEventWord: boolean;
  /** The sponsor cell: the caption over the sponsor's logo. Only with a logo. */
  hasSponsorCell: boolean;
  /** The caption ("Apresentado por") over the logo, inside the sponsor cell. */
  hasCaption: boolean;
  /** The sponsor's logo sits on the small light plate instead of straight on the card. */
  isSponsorLogoOnLightPlate: boolean;
};

/** Whether the sponsor's logo sits on the light plate; a missing switch reads as false. */
export function isSponsorLogoOnLightPlate(data: SponsorBugData): boolean {
  return data.sponsorLogoOnLightPlate ?? false;
}

/**
 * Lists the parts the card has for this data. The sponsor cell exists only with a logo,
 * never as a caption over an empty space (the brief: without a sponsor logo the card is
 * the mark and the event word alone); a caption without a logo is therefore not drawn.
 */
export function listSponsorBugCells(data: SponsorBugData): SponsorBugCells {
  const hasSponsorCell = isTextGiven(data.sponsorLogoUrl);
  return {
    hasEventWord: isTextGiven(data.eventWord),
    hasSponsorCell,
    hasCaption: hasSponsorCell && isTextGiven(data.caption),
    isSponsorLogoOnLightPlate: hasSponsorCell && isSponsorLogoOnLightPlate(data),
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteSponsorBugData(input: unknown): SponsorBugDataCheck {
  const parsed = sponsorBugDataSchema.safeParse(input);
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
export function mergePartialUpdateIntoSponsorBugData(
  currentData: SponsorBugData,
  partialInput: unknown,
): SponsorBugDataCheck {
  const parsedUpdate = partialSponsorBugDataSchema.safeParse(partialInput);
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
  return parseCompleteSponsorBugData(mergedData);
}
