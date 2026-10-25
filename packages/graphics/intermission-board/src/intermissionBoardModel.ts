/**
 * The intermission board's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, which
 * optional parts the board has, and the pages of its sponsor line (the kit's
 * planSponsorPages, up to four logos of one level a page, the sponsor roll's rule).
 * intermission-board.ograf.json describes the same data as JSON Schema;
 * intermissionBoardManifestDataAgreement.test.ts keeps them in step.
 *
 * The next session is a name and `nextStartsAtMs`, an absolute moment the board counts
 * down to itself (the countdown's kit parts). The top five are standings entries, the
 * standings' own items, bound with `topN` 5; the sponsors an entity list of sponsors. Both
 * are optional: without the top five the next session takes the whole width; without
 * sponsors there is no sponsor line.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { planSponsorPages, type SponsorPage } from '@bajaovrlay/graphics-kit/sponsorPages';
import { sponsorLevelsInTheRound } from '@bajaovrlay/graphics-kit/sponsorRound';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The most teams the board shows. */
export const mostTeamsOnTheBoard = 5;

/** How many logos a page of the sponsor line holds (catalogue entry 10). */
export const logosPerSponsorLinePage = 4;

// One team as the standings' entries carry it. Loose, as the standings' manifest items are:
// the binding sends the whole entry (its points by part too), which the board leaves alone.
const topFiveEntrySchema = z.looseObject({
  rank: z.int().min(1).optional(),
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  points: z.number(),
  isDisqualified: z.boolean().optional(),
});

// One sponsor as the entity list of sponsors writes it, as the sponsor roll takes it.
const sponsorLineSponsorSchema = z.strictObject({
  name: z.string().min(1),
  level: z.enum(sponsorLevelsInTheRound),
  logoUrl: z.string().min(1),
  logoOnLightPlate: z.boolean(),
  rollWeight: z.int().min(1).max(10),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const intermissionBoardDataSchema = z.strictObject({
  eventLine: z.string().optional(),
  dateLine: z.string().optional(),
  nextSessionName: z.string().min(1),
  nextStartsAtMs: z.int().min(0),
  topFive: z.array(topFiveEntrySchema).optional(),
  sponsors: z.array(sponsorLineSponsorSchema).optional(),
});

const partialIntermissionBoardDataSchema = intermissionBoardDataSchema.partial();

/** One team of the top five. */
export type TopFiveEntry = z.infer<typeof topFiveEntrySchema>;

/** One sponsor of the sponsor line. */
export type SponsorLineSponsor = z.infer<typeof sponsorLineSponsorSchema>;

/** One page of the sponsor line: a level and up to four of its sponsors. */
export type SponsorLinePage = SponsorPage<SponsorLineSponsor>;

/** Everything the intermission board shows, as the renderer sends it. */
export type IntermissionBoardData = z.infer<typeof intermissionBoardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type IntermissionBoardDataCheck =
  { isValid: true; data: IntermissionBoardData } | { isValid: false; problem: string };

/** The board's optional parts for this data: each only when it has something to show. */
export type IntermissionBoardParts = {
  eventLine: string | undefined;
  dateLine: string | undefined;
  /** The first five teams; none when the top five is left out or empty. */
  topFive: TopFiveEntry[];
  /** The pages of the sponsor line; none when there is no sponsor. */
  sponsorLinePages: SponsorLinePage[];
};

/** Lists the parts this data gives the board. */
export function listIntermissionBoardParts(data: IntermissionBoardData): IntermissionBoardParts {
  return {
    eventLine: isTextGiven(data.eventLine) ? data.eventLine : undefined,
    dateLine: isTextGiven(data.dateLine) ? data.dateLine : undefined,
    topFive: (data.topFive ?? []).slice(0, mostTeamsOnTheBoard),
    sponsorLinePages: planSponsorPages(data.sponsors ?? [], logosPerSponsorLinePage),
  };
}

/** The rank cell of a team: its rank, or "—" for a disqualified team (which has none). */
export function writeRankOfTeam(entry: TopFiveEntry): string {
  const isDisqualified = entry.isDisqualified ?? false;
  return isDisqualified || entry.rank === undefined ? ptBR.emptyMark : String(entry.rank);
}

/** Whether a team's rank sits on the green chip: rank 1, never a disqualified team. */
export function isTeamOnTheLeaderChip(entry: TopFiveEntry): boolean {
  return !(entry.isDisqualified ?? false) && entry.rank === 1;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteIntermissionBoardData(input: unknown): IntermissionBoardDataCheck {
  const parsed = intermissionBoardDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data, never modifying
 * it. A key sent as null or left out on the wire leaves the air through the server's
 * refresh (an optional list that emptied); here a key sent as undefined takes it off.
 */
export function mergePartialUpdateIntoIntermissionBoardData(
  currentData: IntermissionBoardData,
  partialInput: unknown,
): IntermissionBoardDataCheck {
  const parsedUpdate = partialIntermissionBoardDataSchema.safeParse(partialInput);
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
  return parseCompleteIntermissionBoardData({ ...currentData, ...parsedUpdate.data });
}
