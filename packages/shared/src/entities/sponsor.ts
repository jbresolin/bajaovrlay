import { z } from 'zod';

import {
  buildOptionalMediaIdSchema,
  buildRecordIdSchema,
  buildRequiredTextSchema,
} from './entityFieldSchemas.js';
import { reportKeysListedTwice } from './entityKeysListedOnce.js';
import { ptBREntities } from './ptBREntities.js';

const labels = ptBREntities.sponsorFieldLabels;
const problems = ptBREntities.recordProblems;

/** The five sponsor tiers the organisers sell, from the top. */
export const SponsorTierSchema = z.enum(['master', 'ouro', 'prata', 'bronze', 'apoio'], {
  error: problems.unknownTier,
});

/** One of SponsorTierSchema's values. */
export type SponsorTier = z.infer<typeof SponsorTierSchema>;

/**
 * One sponsor of the entity library, for the bug and the sponsor roll. `rollWeight` (1 to
 * 10) says how often it appears in a roll, relative to the others. The logo is optional,
 * like every image of the library: a sponsor imported from CSV has none until one is
 * uploaded on the Patrocinadores tab, and a roll can skip a sponsor with no logo.
 */
export const SponsorSchema = z.object({
  sponsorId: buildRecordIdSchema(labels.sponsorId),
  name: buildRequiredTextSchema(labels.name, 80),
  tier: SponsorTierSchema,
  logoMediaId: buildOptionalMediaIdSchema(labels.logoMediaId),
  rollWeight: z
    .number({ error: problems.rollWeightOutOfRange })
    .int({ error: problems.rollWeightOutOfRange })
    .min(1, { error: problems.rollWeightOutOfRange })
    .max(10, { error: problems.rollWeightOutOfRange }),
});

/** A sponsor that has passed SponsorSchema. */
export type Sponsor = z.infer<typeof SponsorSchema>;

/** A list of sponsors in which each id appears once (a slice, or an import). */
export function buildListOfSponsorsSchema() {
  return z.array(SponsorSchema).superRefine((sponsors, context) => {
    reportKeysListedTwice(
      sponsors.map((sponsor) => sponsor.sponsorId),
      'sponsorId',
      ptBREntities.sliceProblems.idListedTwice,
      context,
    );
  });
}

/** The `sponsors` slice: every sponsor of the library, each id once. Saved. */
export const SponsorsSchema = buildListOfSponsorsSchema();

/** The `sponsors` slice, after validation. */
export type Sponsors = z.infer<typeof SponsorsSchema>;
