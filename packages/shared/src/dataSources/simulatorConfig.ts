import { z } from 'zod';

/**
 * How the race simulator is set up. Every field has a default, so `{}` is a complete
 * config once parsed (the seeded "Simulador — Enduro" is exactly that). The control page's
 * form and the server's simulator adapter use this same schema (decision D4).
 */
export const SimulatorConfigSchema = z.object({
  /** The seed of every random draw: the same seed and moment always give the same race. */
  seed: z.number().int().default(2027),
  /** How many cars race; the fictional team list has a hundred. */
  carCount: z.number().int().min(10).max(100).default(60),
  /** How long the session runs before the checkered flag; four hours by default. */
  sessionDurationMs: z.number().int().positive().default(14_400_000),
  /** The length of one lap, used only to keep lap times plausible. */
  lapLengthKm: z.number().positive().default(2),
  /** How many times faster than real time the simulated race runs, from 1 to 60. */
  speed: z.number().int().min(1).max(60).default(1),
  /**
   * The wall-clock moment the simulated race started. Set by the server when the source
   * is turned on and this is missing, so a restart carries the race on where it was.
   */
  simulatedStartAtMs: z.number().int().optional(),
  /** While true every poll fails with "falha simulada", to rehearse the stale path. */
  isFailing: z.boolean().default(false),
});

/** A simulator config after parsing, defaults filled in. */
export type SimulatorConfig = z.infer<typeof SimulatorConfigSchema>;
