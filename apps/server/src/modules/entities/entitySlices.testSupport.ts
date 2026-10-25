// Test support: records of the entity library as the Cadastros page sends them, and race
// day slices that hold them. Every function builds fresh objects on each call, so no test
// can change what another one sees.
import type { Item, People, ScheduleSlots, Sponsors, Team, Teams } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';
import { buildRaceDaySlicesWithRundown } from '../../core/store/reducers/rundownSlices.testSupport.js';

/** Team 42, Baja UFPR, from Curitiba, with no images yet. */
export function buildTeam42(): Team {
  return {
    carNumber: 42,
    teamName: 'Baja UFPR',
    schoolName: 'UFPR',
    schoolFullName: 'Universidade Federal do Paraná',
    city: 'Curitiba',
    state: 'PR',
  };
}

/** Team 7, Juriti Off-Road, from Joinville, with no images. */
export function buildTeam7(): Team {
  return {
    carNumber: 7,
    teamName: 'Juriti Off-Road',
    schoolName: 'UDESC',
    city: 'Joinville',
    state: 'SC',
  };
}

/** Team 13, Mutum Off-Road, from Londrina: a third car, for imports. */
export function buildTeam13(): Team {
  return {
    carNumber: 13,
    teamName: 'Mutum Off-Road',
    schoolName: 'UEL',
    city: 'Londrina',
    state: 'PR',
  };
}

/** The narrator and a safety judge, as the Pessoas tab holds them. */
export function buildNarratorAndJudge(): People {
  return [
    { personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' },
    { personId: 'juiz-seguranca', name: 'Carla Menezes', role: 'Juíza de segurança' },
  ];
}

/** The master sponsor and a supporter, as the Patrocinadores tab holds them. */
export function buildMasterAndSupportSponsors(): Sponsors {
  return [
    {
      sponsorId: 'patrocinador-master',
      name: 'Mineradora Serra Azul',
      tier: 'diamante',
      rollWeight: 10,
    },
    { sponsorId: 'apoio-pneus', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 },
  ];
}

/** Saturday's enduro, 10:00 to 14:00 in Brasília, on the main track. */
export function buildSaturdayEnduroSlots(): ScheduleSlots {
  return [
    {
      slotId: 'enduro-sabado',
      sessionName: 'Enduro de Resistência',
      sessionKind: 'enduro',
      startsAtMs: Date.parse('2026-11-14T13:00:00.000Z'),
      endsAtMs: Date.parse('2026-11-14T17:00:00.000Z'),
      place: 'Pista principal',
    },
  ];
}

/**
 * Race day slices (the seeded layers, the race clock and a team lower third, the two
 * rundowns) with the given entity records and items, nothing else in the library.
 */
export function buildRaceDaySlicesWithEntities(parts: {
  teams?: Teams;
  people?: People;
  sponsors?: Sponsors;
  scheduleSlots?: ScheduleSlots;
  items?: Item[];
}): SlicesChangedByCommands {
  return {
    ...buildRaceDaySlicesWithRundown({ items: parts.items ?? [] }),
    teams: parts.teams ?? [],
    people: parts.people ?? [],
    sponsors: parts.sponsors ?? [],
    scheduleSlots: parts.scheduleSlots ?? [],
  };
}
