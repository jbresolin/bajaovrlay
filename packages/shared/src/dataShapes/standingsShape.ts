import { z } from 'zod';

import { SessionKindSchema } from './dataShapeKey.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/** What the standings add up: every event (`overall`) or one kind of session. */
export const StandingsScopeSchema = z.union([z.literal('overall'), SessionKindSchema]);

/** One standings scope. */
export type StandingsScope = z.infer<typeof StandingsScopeSchema>;

/**
 * One part of the score, as the source names it: the real overall export has PROJETO,
 * DINÂM., ENDURO, 4X4, SEG. and PEN. The parts are the source's own, not session kinds:
 * the real score is not a sum of events (BAJAOVRLAY-24).
 */
export const StandingsScorePartSchema = z.object({
  /** The key a team's `pointsByPart` uses for this part: "projeto". */
  partId: z.string().min(1),
  /** The column head in pt-BR, as the source writes it: "PROJETO", "DINÂM.". */
  label: z.string().min(1),
});

/** One part of the score that has passed StandingsScorePartSchema. */
export type StandingsScorePart = z.infer<typeof StandingsScorePartSchema>;

/**
 * One team in the standings, repeating its team and school so a graphic never joins.
 * Not strict: a field this shape no longer has (`pointsByEvent`, replaced by
 * `pointsByPart` in BAJAOVRLAY-24) is dropped, never refused, so old recordings replay.
 */
export const StandingsEntrySchema = z.object({
  /**
   * The team's rank, from 1. Two teams may share a rank when tied. Absent exactly when
   * the team is disqualified (a rule of the shape below).
   */
  rank: z.number().int().min(1).optional(),
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  /** Points in this scope. Not always whole: some events score fractions. */
  points: z.number(),
  /**
   * Points per part of the score, by `partId`, when the source knows them; a part left out
   * is unknown and shown as "—". Penalties (PEN.) and safety (SEG.) may be negative.
   */
  pointsByPart: z.record(z.string(), z.number()).optional(),
  /** True for a team disqualified from the competition: it stays in the list, unranked. */
  isDisqualified: z.boolean().optional(),
});

/** One team that has passed StandingsEntrySchema. */
export type StandingsEntry = z.infer<typeof StandingsEntrySchema>;

/**
 * The standings shape: teams ordered by rank, for one scope, with the parts of the score
 * when the source has them. Ranks start at 1 and never go down the list (ties share a
 * rank), a team appears once, and disqualified teams (unranked) come after every ranked
 * one, so a graphic can show the entries in the order they come.
 */
export const StandingsShapeSchema = z
  .object({
    scope: StandingsScopeSchema,
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    /** The parts of the score, in the order they are shown; absent for a total alone. */
    scoreParts: z.array(StandingsScorePartSchema).optional(),
    entries: z.array(StandingsEntrySchema),
  })
  .superRefine((standings, context) => {
    const reasons = ptBRDataShapes.shapeRuleReasons;

    const partIdsListed = new Set<string>();
    (standings.scoreParts ?? []).forEach((scorePart, index) => {
      // A part listed twice would draw two columns with the same numbers.
      if (partIdsListed.has(scorePart.partId)) {
        context.addIssue({
          code: 'custom',
          path: ['scoreParts', index, 'partId'],
          message: reasons.scorePartListedTwice(scorePart.partId),
        });
      }
      partIdsListed.add(scorePart.partId);
    });

    const carNumbersSeen = new Set<number>();
    let rankOfTheLastRankedEntryAbove: number | undefined;
    let hasADisqualifiedEntryAbove = false;
    standings.entries.forEach((entry, index) => {
      // A team listed twice would show twice on a standings graphic.
      if (carNumbersSeen.has(entry.carNumber)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'carNumber'],
          message: reasons.carListedTwice(entry.carNumber),
        });
      }
      carNumbersSeen.add(entry.carNumber);

      // A part with no column would be lost from the graphic without a word.
      for (const partId of Object.keys(entry.pointsByPart ?? {})) {
        if (!partIdsListed.has(partId)) {
          context.addIssue({
            code: 'custom',
            path: ['entries', index, 'pointsByPart', partId],
            message: reasons.unknownScorePart(partId),
          });
        }
      }

      const isDisqualified = entry.isDisqualified ?? false;
      if (isDisqualified) {
        // A rank on a disqualified team would be drawn as a place it does not have.
        if (entry.rank !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['entries', index, 'rank'],
            message: reasons.disqualifiedWithRank,
          });
        }
        hasADisqualifiedEntryAbove = true;
        return;
      }

      // From here on the team is ranked: it needs its rank, below every ranked team with
      // a better or equal one, and above every disqualified team.
      if (entry.rank === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'rank'],
          message: reasons.rankMissingOnRankedTeam,
        });
        return;
      }
      if (hasADisqualifiedEntryAbove) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'rank'],
          message: reasons.rankedTeamBelowDisqualified,
        });
      }
      const isTheFirstRankedEntry = rankOfTheLastRankedEntryAbove === undefined;
      if (isTheFirstRankedEntry && entry.rank !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'rank'],
          message: reasons.firstRankNotOne,
        });
      }
      if (
        rankOfTheLastRankedEntryAbove !== undefined &&
        entry.rank < rankOfTheLastRankedEntryAbove
      ) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'rank'],
          message: reasons.rankOutOfOrder(rankOfTheLastRankedEntryAbove),
        });
      }
      rankOfTheLastRankedEntryAbove = entry.rank;
    });
  });

/** Standings that have passed StandingsShapeSchema. */
export type StandingsShape = z.infer<typeof StandingsShapeSchema>;
