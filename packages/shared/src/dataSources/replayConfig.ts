import { z } from 'zod';

/** The speeds a replay can run at: the fixed list the replay form offers. */
export const replaySpeeds = [1, 2, 5, 10, 30, 60] as const;

/**
 * How a replay of a recorded feed is set up (rehearsal mode, concept §7 rule 8). The
 * control page's form and the server's replay adapter use this same schema (D4).
 */
export const ReplayConfigSchema = z.object({
  /** The recording to play back: an id from the `recordings` slice. */
  recordingId: z.string().min(1),
  /** How many times faster than it was recorded; one of `replaySpeeds`. */
  speed: z.literal(replaySpeeds).default(1),
  /** Whether to start again at the end; otherwise the last snapshot is kept. */
  isLooping: z.boolean().default(false),
  /** How far into the recording to start, in recorded milliseconds. */
  startOffsetMs: z.number().int().min(0).optional(),
  /**
   * The wall-clock moment the replay started. Set by the server every time the source is
   * turned on, so every rehearsal starts from the top (decision D5).
   */
  replayStartedAtMs: z.number().int().optional(),
});

/** A replay config after parsing, defaults filled in. */
export type ReplayConfig = z.infer<typeof ReplayConfigSchema>;
