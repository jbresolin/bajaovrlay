import { z } from 'zod';

import { SessionKindSchema } from './dataShapeKey.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/** What the standings add up: every event (`overall`) or one kind of session. */
export const StandingsScopeSchema = z.union([z.literal('overall'), SessionKindSchema]);

/** One standings scope. */
export type StandingsScope = z.infer<typeof StandingsScopeSchema>;

/** One team in the standings, repeating its team and school so a graphic never joins. */
export const StandingsEntrySchema = z.object({
  /** The team's rank, from 1. Two teams may share a rank when tied. */
  rank: z.number().int().min(1),
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  /** Points in this scope. Not always whole: some events score fractions. */
  points: z.number(),
  /** Points per event, when the source knows them; an event left out is unknown. */
  pointsByEvent: z.partialRecord(SessionKindSchema, z.number()).optional(),
});

/** One team that has passed StandingsEntrySchema. */
export type StandingsEntry = z.infer<typeof StandingsEntrySchema>;

/**
 * The standings shape: teams ordered by rank, for one scope. Ranks start at 1 and never go
 * down the list (ties share a rank), and a team appears once, so a graphic can show the
 * entries in the order they come.
 */
export const StandingsShapeSchema = z
  .object({
    scope: StandingsScopeSchema,
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    entries: z.array(StandingsEntrySchema),
  })
  .superRefine((standings, context) => {
    const reasons = ptBRDataShapes.shapeRuleReasons;
    const carNumbersSeen = new Set<number>();
    const firstEntry = standings.entries[0];
    if (firstEntry !== undefined && firstEntry.rank !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['entries', 0, 'rank'],
        message: reasons.firstRankNotOne,
      });
    }

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

      const entryAbove = standings.entries[index - 1];
      if (entryAbove !== undefined && entry.rank < entryAbove.rank) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'rank'],
          message: reasons.rankOutOfOrder(entryAbove.rank),
        });
      }
    });
  });

/** Standings that have passed StandingsShapeSchema. */
export type StandingsShape = z.infer<typeof StandingsShapeSchema>;
