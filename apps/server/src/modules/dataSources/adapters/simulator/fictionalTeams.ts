// The teams of the simulated enduro: a hundred made-up teams read from
// teams.fictional.json. They are fictional and must never be shown as real results.
import { z } from 'zod';

import teamsFile from './teams.fictional.json' with { type: 'json' };

/** One fictional team: its name and its school's short form ("UFPR"). */
export type FictionalTeam = { teamName: string; schoolName: string };

const FictionalTeamsFileSchema = z.object({
  notice: z.string().min(1),
  teams: z
    .array(z.object({ teamName: z.string().min(1), schoolName: z.string().min(1) }))
    .length(100),
});

// Checked once when the server loads this file: a broken edit of the JSON stops the
// server at boot with Zod's message, rather than a simulator poll failing later.
const fictionalTeams: FictionalTeam[] = FictionalTeamsFileSchema.parse(teamsFile).teams;

/**
 * Every fictional team, in the order of the file: car 1 is the first. The entity library
 * imports them as teams for walks and rehearsals ("Importar equipes do simulador").
 */
export function listFictionalTeams(): FictionalTeam[] {
  return [...fictionalTeams];
}

/**
 * The team of the car at `carIndex` in the field (from 0). The field takes the first
 * `carCount` teams of the file, in order, so car 1 is always the first team.
 */
export function readFictionalTeamOfCar(carIndex: number): FictionalTeam {
  const team = fictionalTeams[carIndex];
  if (team === undefined) {
    // carCount is at most 100 (SimulatorConfigSchema), so this is a bug if it happens.
    throw new Error(`there is no fictional team for car index ${String(carIndex)}`);
  }
  return team;
}
