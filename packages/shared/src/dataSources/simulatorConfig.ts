import { z } from 'zod';

/**
 * How the race simulator is set up. Every field has a default, so `{}` is a complete
 * config once parsed (the seeded "Simulador — Enduro" is exactly that). The control page's
 * form and the server's simulator adapter use this same schema (decision D4).
 */
export const SimulatorConfigSchema = z.object({
  /**
   * The seed of every random draw: the same seed and moment always give the same race.
   * A whole number from 0 to 2^32 − 1, the unsigned 32-bit range: the simulator's
   * generator (mulberry32, after an FNV-1a mix) reads only a seed's low 32 bits, so a
   * larger or negative seed would silently be another seed's race (2^32 races as 0).
   */
  seed: z.number().int().min(0).max(4_294_967_295).default(2027),
  /** How many cars race; the fictional team list has a hundred. */
  carCount: z.number().int().min(10).max(100).default(60),
  /**
   * How long the session runs before the checkered flag; four hours by default, a day at
   * most. The cap refuses a typo with extra zeros: every poll drives each car lap by lap
   * through the whole session, so a session of months would block the server on each poll.
   */
  sessionDurationMs: z.number().int().positive().max(86_400_000).default(14_400_000),
  /** The length of one lap. Accepted but not read yet: lap times are written for the default 2 km track. */
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
  /**
   * While true the simulator also answers the superChats shape: a fictional viewer's paid
   * message about every 5 simulated minutes, seeded like the race, so the whole Super Chat
   * flow (approval, "No ar") can be rehearsed with no live stream (BAJAOVRLAY-35). Missing
   * means off, so a rehearsal of the race alone fills no inbox with Super Chats; optional
   * rather than defaulted so every config saved before it reads back unchanged.
   */
  areSuperChatsSimulated: z.boolean().optional(),
});

/** A simulator config after parsing, defaults filled in. */
export type SimulatorConfig = z.infer<typeof SimulatorConfigSchema>;
