import { z } from 'zod';

import { SessionKindSchema } from './dataShapeKey.js';

/**
 * The session's flag. These are the race clock manifest's `state` values, exactly and in
 * the same order, so a binding feeds the clock's flag with no transform.
 * sessionShapeMatchesRaceClock.test.ts reads the manifest and fails if they drift apart.
 */
export const SessionStateSchema = z.enum([
  'pre',
  'green',
  'yellow',
  'red',
  'checkered',
  'finished',
]);

/** One session flag. */
export type SessionState = z.infer<typeof SessionStateSchema>;

/**
 * The session clock as one reading, with the race clock's own field names (and the
 * shared `ClockReading` type's), so the whole object feeds the clock with no rename.
 * The clock is worked out at any moment from the reading; see ../clock/.
 */
export const SessionClockSchema = z.object({
  /** Whether the clock counts time since the start or time left until the end. */
  clockMode: z.enum(['elapsed', 'remaining']),
  /** The time the clock read, in ms, at `referenceWallClockMs`. */
  referenceTimeMs: z.number().int().min(0),
  /** The wall-clock moment of the reading, in ms since 1970 (the server's clock). */
  referenceWallClockMs: z.number().int().min(0),
  /** False while the clock is held (a red flag, the end), true while it counts. */
  running: z.boolean(),
});

/** A session clock reading that has passed SessionClockSchema. */
export type SessionClock = z.infer<typeof SessionClockSchema>;

/**
 * The session shape: which event and session is running, its flag and its clock. One
 * per session; a source that knows no session simply does not produce it.
 */
export const SessionShapeSchema = z.object({
  sessionId: z.string().min(1),
  /** The event, e.g. "Baja SAE Brasil 2027 — Etapa Nacional". */
  eventName: z.string().min(1),
  /** The session, e.g. "Enduro de Resistência". */
  sessionName: z.string().min(1),
  sessionKind: SessionKindSchema,
  state: SessionStateSchema,
  clock: SessionClockSchema,
  /** How long the session is planned to last, in ms; left out when the source does not know. */
  scheduledDurationMs: z.number().int().positive().optional(),
  /** Laps the leader has completed; left out when the source does not know. */
  lapsCompletedByLeader: z.number().int().min(0).optional(),
  /** When the source produced this, in ms since 1970 (the server's clock). */
  updatedAtMs: z.number().int().min(0),
});

/** A session that has passed SessionShapeSchema. */
export type SessionShape = z.infer<typeof SessionShapeSchema>;
