import type { Team } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * The place of a team in one line: "Curitiba – PR", the part it has when it has only one,
 * or undefined when it has neither (city and state are optional since gate 2 of PR #23),
 * so no cell ever shows a dangling dash.
 */
export function writePlaceOfTeam(team: Team): string | undefined {
  if (team.city !== undefined && team.state !== undefined) {
    return ptBR.entityLibrary.cityAndState(team.city, team.state);
  }
  return team.city ?? team.state;
}
