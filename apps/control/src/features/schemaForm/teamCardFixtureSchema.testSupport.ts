// Test support: the data schema of a team card, the graphic the entity library is first
// for (no such graphic is built yet): a title, an image field for the logo (the
// `v_baja.role: imageUrl` convention), and the laps of the car. Each function builds new
// objects on every call.
import type { EntityLibrary } from '@bajaovrlay/shared';
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';

/** The team card's data schema: titulo (required), logo (an image field), voltas. */
export function buildTeamCardFixtureDataSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      titulo: { type: 'string', title: 'Título' },
      logo: { type: 'string', title: 'Logo', v_baja: { role: 'imageUrl' } },
      voltas: { type: 'integer', title: 'Voltas' },
    },
    required: ['titulo'],
  };
}

/** The form description of the team card. */
export function describeTeamCardFixture(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema(buildTeamCardFixtureDataSchema());
}

/** The media id of team 42's logo. */
export const logoOfTeam42MediaId = buildFakeMediaId(3);

/** Team 42 (Baja UFPR, with its logo), team 7 (Juriti Off-Road) and the narrator. */
export function buildLibraryForTheTeamCard(): EntityLibrary {
  return {
    teams: [
      {
        carNumber: 42,
        teamName: 'Baja UFPR',
        schoolName: 'UFPR',
        city: 'Curitiba',
        state: 'PR',
        logoMediaId: logoOfTeam42MediaId,
      },
      {
        carNumber: 7,
        teamName: 'Juriti Off-Road',
        schoolName: 'UDESC',
        city: 'Joinville',
        state: 'SC',
      },
    ],
    people: [{ personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' }],
    sponsors: [],
    scheduleSlots: [],
  };
}
