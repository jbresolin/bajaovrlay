/**
 * The simulator's fictional teams as entity records: GET /api/v1/entities/simulator-teams
 * (apps/server)
 *
 * What this module is for:
 *   "Importar equipes do simulador" on the Cadastros page loads the simulator's hundred
 *   fictional teams into the library, so walks and rehearsals have teams to show
 *   (BAJAOVRLAY-19). This route answers them as team records, with the car number the
 *   simulator gives each (car 1 is the first team of teams.fictional.json) and the city
 *   and state of its school, so they pass the team schema. It changes nothing: the page
 *   sends importEntities itself, after asking when teams already exist.
 *
 * What these tests prove:
 *   - The answer names the teams as fictional and holds a hundred teams, cars 1 to 100,
 *     each passing the shared team schema with no image.
 *   - Car 1 is the simulator's first team with its school's place, so a car in the
 *     simulated race and its imported team join by number.
 *   - The route changes no slice and writes no event-log row.
 *
 * What these tests deliberately do not cover:
 *   - The import itself; entitiesThroughTheStore.test.ts and the Cadastros page's tests.
 */
import { TeamSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createAppWithAMediaFolder } from '../media/mediaOnTheApp.testSupport.js';

/** What the route answers, as these tests read it. */
type SimulatorTeamsAnswer = { notice: string; teams: unknown[] };

describe('GET /api/v1/entities/simulator-teams', () => {
  it('answers a hundred fictional teams, cars 1 to 100, each a valid team', async () => {
    // Arrange: the app.
    const { app } = createAppWithAMediaFolder();

    // Act: ask for the simulator's teams, as the button does.
    const response = await app.request('/api/v1/entities/simulator-teams');
    const body = (await response.json()) as SimulatorTeamsAnswer;

    // Assert: a hundred teams that pass the shared schema, numbered as the simulator does.
    expect(response.status, 'the route must answer 200').toBe(200);
    expect(body.notice, 'the teams are said to be fictional').toContain('fictícias');
    expect(body.teams, 'a hundred teams').toHaveLength(100);
    const carNumbers = body.teams.map((team) => TeamSchema.parse(team).carNumber);
    expect(carNumbers, 'cars 1 to 100, in order').toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
  });

  it("gives car 1 the simulator's first team with its school's place", async () => {
    // Arrange: the app.
    const { app } = createAppWithAMediaFolder();

    // Act: ask for the teams.
    const body = (await (
      await app.request('/api/v1/entities/simulator-teams')
    ).json()) as SimulatorTeamsAnswer;

    // Assert: Cascavel Off-Road, of UNIOESTE in Cascavel (PR), with no image.
    expect(body.teams[0], 'car 1 is the first fictional team').toEqual({
      carNumber: 1,
      teamName: 'Cascavel Off-Road',
      schoolName: 'UNIOESTE',
      city: 'Cascavel',
      state: 'PR',
    });
  });

  it('changes nothing in the store', async () => {
    // Arrange: the app and its store, and the event log as it is.
    const { app, stateStore } = createAppWithAMediaFolder();
    const slicesBefore = stateStore.readAllSlices();

    // Act: ask for the teams.
    await app.request('/api/v1/entities/simulator-teams');

    // Assert: no team stored and no event-log row: the page imports them itself.
    expect(stateStore.readAllSlices().teams, 'no team is stored').toEqual([]);
    expect(stateStore.readAllSlices().eventLog, 'no row is written').toEqual(slicesBefore.eventLog);
  });
});
