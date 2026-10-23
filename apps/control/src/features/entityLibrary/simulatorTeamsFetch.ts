import { type Team, TeamsSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

/** The address of the simulator's teams, on the page's own server. */
export const simulatorTeamsAddress = '/api/v1/entities/simulator-teams';

const SimulatorTeamsAnswerSchema = z.object({ notice: z.string(), teams: TeamsSchema });

/** What asking for the simulator's teams gives: the teams, or why not. */
export type SimulatorTeamsOutcome =
  { isFetched: true; teams: Team[] } | { isFetched: false; reason: string };

/**
 * Asks the server for the simulator's hundred fictional teams as team records (GET
 * /api/v1/entities/simulator-teams). Nothing is stored by it: the page then sends them
 * with importEntities. Never throws; a server the page cannot reach answers the catalog's
 * sentence.
 */
export async function fetchSimulatorTeams(): Promise<SimulatorTeamsOutcome> {
  const serverUnreachable = ptBR.entityLibrary.simulator.serverUnreachable;
  try {
    const response = await fetch(simulatorTeamsAddress);
    if (!response.ok) {
      return { isFetched: false, reason: serverUnreachable };
    }
    const answer = SimulatorTeamsAnswerSchema.parse(await response.json());
    return { isFetched: true, teams: answer.teams };
  } catch {
    return { isFetched: false, reason: serverUnreachable };
  }
}
