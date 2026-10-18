import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

/** What a car is doing. The positions tower has one look for each; the list is closed. */
export const PositionStatusSchema = z.enum([
  'running',
  'inPit',
  'stopped',
  'retired',
  'disqualified',
  'notStarted',
]);

/** One car status. */
export type PositionStatus = z.infer<typeof PositionStatusSchema>;

/**
 * One car in the positions. It repeats the team and school so a graphic never joins
 * tables. Every optional field means "the source does not know", never a placeholder.
 */
export const PositionEntrySchema = z.object({
  /** The car's place, from 1. */
  position: z.number().int().min(1),
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  /** Laps completed. */
  laps: z.number().int().min(0),
  lastLapMs: z.number().int().min(0).optional(),
  bestLapMs: z.number().int().min(0).optional(),
  /** Time behind the leader, when on the leader's lap. Never together with gapToLeaderLaps. */
  gapToLeaderMs: z.number().int().min(0).optional(),
  /** Laps behind the leader, when lapped. Never together with gapToLeaderMs. */
  gapToLeaderLaps: z.number().int().min(1).optional(),
  /** Time behind the car one place ahead, measured at this car's last completed lap. */
  intervalMs: z.number().int().min(0).optional(),
  pitStops: z.number().int().min(0).optional(),
  status: PositionStatusSchema,
});

/** One car that has passed PositionEntrySchema. */
export type PositionEntry = z.infer<typeof PositionEntrySchema>;

/**
 * Checks the rules no single field can say (decision D2 of BAJAOVRLAY-17):
 * - entries come in order, positions 1, 2, 3... with no gap or repeat;
 * - a car appears once;
 * - a car never has more laps than the car ahead of it;
 * - the gaps follow findBrokenGapRule and the intervals follow findBrokenIntervalRule.
 * Each broken rule is reported at the entry (or field) it is about.
 */
function checkRulesAcrossPositionEntries(entries: PositionEntry[], context: z.RefinementCtx) {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  const carNumbersSeen = new Set<number>();
  const leader = entries[0];

  entries.forEach((entry, index) => {
    const expectedPosition = index + 1;
    if (entry.position !== expectedPosition) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'position'],
        message: reasons.positionOutOfOrder(expectedPosition),
      });
    }

    if (carNumbersSeen.has(entry.carNumber)) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'carNumber'],
        message: reasons.carListedTwice(entry.carNumber),
      });
    }
    carNumbersSeen.add(entry.carNumber);

    // The order is by laps first, so a car with more laps than the one ahead is out of
    // place; the gap rules below rely on this (a leader on 0 laps means nobody has a lap).
    const carAhead = entries[index - 1];
    if (carAhead !== undefined && entry.laps > carAhead.laps) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'laps'],
        message: reasons.moreLapsThanCarAhead(carAhead.laps),
      });
    }

    if (leader === undefined) {
      return;
    }
    const brokenGapRuleReason = findBrokenGapRule(entry, leader, index === 0);
    if (brokenGapRuleReason !== null) {
      context.addIssue({ code: 'custom', path: ['entries', index], message: brokenGapRuleReason });
    }
    const brokenIntervalRuleReason = findBrokenIntervalRule(entry, index === 0);
    if (brokenIntervalRuleReason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'intervalMs'],
        message: brokenIntervalRuleReason,
      });
    }
  });
}

/**
 * Returns the pt-BR reason when one car's gaps break D2, or null when they are right:
 * the leader carries none; before the leader's first lap nobody does; after it, a car on
 * the leader's lap carries gapToLeaderMs and any other car carries gapToLeaderLaps equal
 * to the laps it is behind (the rule the simulator follows too).
 */
function findBrokenGapRule(
  entry: PositionEntry,
  leader: PositionEntry,
  isLeader: boolean,
): string | null {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  const hasGapInMs = entry.gapToLeaderMs !== undefined;
  const hasGapInLaps = entry.gapToLeaderLaps !== undefined;
  const hasAnyGap = hasGapInMs || hasGapInLaps;
  const hasExactlyOneGap = hasGapInMs !== hasGapInLaps;
  const hasLeaderCompletedALap = leader.laps >= 1;

  if (isLeader) {
    return hasAnyGap ? reasons.leaderWithGap : null;
  }
  if (!hasLeaderCompletedALap) {
    return hasAnyGap ? reasons.gapBeforeFirstLap : null;
  }
  if (!hasExactlyOneGap) {
    return reasons.gapMissingOrDoubled;
  }

  const lapsBehindLeader = leader.laps - entry.laps;
  const isOnLeaderLap = lapsBehindLeader === 0;
  if (isOnLeaderLap) {
    return hasGapInMs ? null : reasons.gapInLapsOnLeaderLap;
  }
  if (hasGapInMs) {
    return reasons.gapInMsWhenLapped;
  }
  return entry.gapToLeaderLaps === lapsBehindLeader
    ? null
    : reasons.gapInLapsNotMatchingLaps(lapsBehindLeader);
}

/**
 * Returns the pt-BR reason when one car's interval cannot be right, or null. The leader
 * has no car ahead, and a car with no lap has no lap at which to measure one. A car with
 * laps may leave it out (unknown), even when lapped: it is measured at its own last lap.
 */
function findBrokenIntervalRule(entry: PositionEntry, isLeader: boolean): string | null {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (entry.intervalMs === undefined) {
    return null;
  }
  if (isLeader) {
    return reasons.leaderWithInterval;
  }
  return entry.laps >= 1 ? null : reasons.intervalBeforeFirstLap;
}

/**
 * The positions shape: every car of one session, ordered by position. What the positions
 * tower and the team card read.
 */
export const PositionsShapeSchema = z
  .object({
    sessionId: z.string().min(1),
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    entries: z.array(PositionEntrySchema),
  })
  .superRefine((positions, context) => {
    checkRulesAcrossPositionEntries(positions.entries, context);
  });

/** Positions that have passed PositionsShapeSchema. */
export type PositionsShape = z.infer<typeof PositionsShapeSchema>;
