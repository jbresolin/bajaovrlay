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
  /** Above zero: no lap takes no time, so a 0 would be a placeholder for "unknown". */
  lastLapMs: z.number().int().positive().optional(),
  /** Above zero, like lastLapMs. */
  bestLapMs: z.number().int().positive().optional(),
  /** Time behind the leader, only for a car on the leader's lap. Never with gapToLeaderLaps. */
  gapToLeaderMs: z.number().int().min(0).optional(),
  /** Laps behind the leader, only for a lapped car. Never with gapToLeaderMs. */
  gapToLeaderLaps: z.number().int().min(1).optional(),
  /** Time behind the car one place ahead, as the source measures it. */
  intervalMs: z.number().int().min(0).optional(),
  pitStops: z.number().int().min(0).optional(),
  /**
   * Refuels. The simulator counts every pit stop as one, so there it equals pitStops; a
   * real scoring app may count them differently (a stop for a repair is not a refuel).
   */
  fuelStops: z.number().int().min(0).optional(),
  status: PositionStatusSchema,
});

/** One car that has passed PositionEntrySchema. */
export type PositionEntry = z.infer<typeof PositionEntrySchema>;

/**
 * The statuses of a car out of the race. A timing system lists such a car wherever it
 * likes (often at the bottom, whatever its laps), so it is left out of the lap order
 * (gate 2 of PR #16, João's ruling).
 */
const statusesOutOfLapOrder: ReadonlySet<PositionStatus> = new Set([
  'retired',
  'disqualified',
  'notStarted',
]);

/** True for a car still in the race: running, in the pit or stopped for a repair. */
function isCarInLapOrder(entry: PositionEntry): boolean {
  return !statusesOutOfLapOrder.has(entry.status);
}

/**
 * Checks the rules no single field can say (gate 2 of PR #16 replaces decision D2 of
 * BAJAOVRLAY-17; the shape accepts what a source gives, as long as it is not wrong):
 * - entries come in order, positions 1, 2, 3... with no gap or repeat;
 * - a car appears once;
 * - a car in the race never has more laps than the nearest car in the race ahead of it;
 * - the gaps follow findBrokenGapRule, measured from the leader, which is position 1
 *   whatever its status;
 * - the leader carries no interval (no car is ahead of it).
 * Each broken rule is reported at the entry (or field) it is about.
 */
function checkRulesAcrossPositionEntries(entries: PositionEntry[], context: z.RefinementCtx) {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  const carNumbersSeen = new Set<number>();
  // The leader is position 1 whatever its status, because a timing system (our simulator
  // included) ranks a retired car with the most laps first and measures every gap from it.
  // What could go wrong: a source listing a car out of the race first with FEWER laps than
  // the cars below gets their gaps refused (gapOnCarWithMoreLapsThanLeader); it should then
  // leave the gaps out.
  const leader = entries[0];
  // The last car in the race seen so far, walking down the list: the one a car in the
  // race is compared with. Cars out of the race are skipped, never compared.
  let nearestCarInLapOrderAhead: PositionEntry | undefined;

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

    // The order of the cars in the race is by laps first, so one with more laps than the
    // car in the race ahead of it is out of place. A retired, disqualified or not-started
    // car may sit anywhere, so it neither breaks this rule nor sets the laps to beat.
    if (isCarInLapOrder(entry)) {
      const lapsOfCarAhead = nearestCarInLapOrderAhead?.laps;
      if (lapsOfCarAhead !== undefined && entry.laps > lapsOfCarAhead) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'laps'],
          message: reasons.moreLapsThanRacingCarAhead(lapsOfCarAhead),
        });
      }
      nearestCarInLapOrderAhead = entry;
    }

    if (leader === undefined) {
      return;
    }
    const isLeader = index === 0;
    const brokenGapRuleReason = findBrokenGapRule(entry, leader, isLeader);
    if (brokenGapRuleReason !== null) {
      context.addIssue({ code: 'custom', path: ['entries', index], message: brokenGapRuleReason });
    }
    // Any other car may carry an interval, even before its first lap: the source measures it.
    if (isLeader && entry.intervalMs !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'intervalMs'],
        message: reasons.leaderWithInterval,
      });
    }
  });
}

/**
 * Returns the pt-BR reason when one car's gap is of the wrong kind, or null when it is
 * right or absent (a gap is optional: the source may not know it). The leader (position 1,
 * whatever its status) carries none; a car never carries both; gapToLeaderMs only on the
 * leader's lap; gapToLeaderLaps only when lapped, equal to the laps behind; and a car with
 * more laps than the leader carries none.
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

  if (!hasAnyGap) {
    return null;
  }
  if (isLeader) {
    return reasons.leaderWithGap;
  }
  if (hasGapInMs && hasGapInLaps) {
    return reasons.gapInBothMsAndLaps;
  }

  const lapsBehindLeader = leader.laps - entry.laps;
  const isOnLeaderLap = lapsBehindLeader === 0;
  const hasMoreLapsThanLeader = lapsBehindLeader < 0;
  if (hasMoreLapsThanLeader) {
    return reasons.gapOnCarWithMoreLapsThanLeader;
  }
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
