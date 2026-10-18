import { z } from 'zod';

/**
 * Starts a simulator's race again from its green flag ("Reiniciar corrida", João's
 * ruling 3 at gate 2 of PR #16): the server moves the race start to now.
 */
export const RestartSimulatedRaceCommandSchema = z.object({
  type: z.literal('restartSimulatedRace'),
  sourceId: z.string().min(1),
});

/** A restartSimulatedRace command after validation. */
export type RestartSimulatedRaceCommand = z.infer<typeof RestartSimulatedRaceCommandSchema>;
