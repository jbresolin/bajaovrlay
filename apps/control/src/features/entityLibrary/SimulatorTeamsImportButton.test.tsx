/**
 * "Importar equipes do simulador" on the Equipes tab (apps/control)
 *
 * What this module is for:
 *   For walks and rehearsals the Equipes tab loads the simulator's hundred fictional teams
 *   as entities (BAJAOVRLAY-19): it asks the server for them (GET
 *   /api/v1/entities/simulator-teams) and sends them as one importEntities. The button
 *   says they are fictional, and when the library already holds teams it asks first,
 *   since a simulator team replaces the team of the same car.
 *
 * What these tests prove:
 *   - With no team stored, one press fetches the teams and sends one importEntities.
 *   - With teams stored, the press asks first and sends nothing; "Cancelar" leaves it so,
 *     and "Importar mesmo assim" sends the import.
 *
 * What these tests deliberately do not cover:
 *   - Which teams the server answers; simulatorTeamsRoute.test.ts in apps/server.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam7,
  buildTeam42WithItsLogo,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** Two of the simulator's teams, as the route answers them (the real one has a hundred). */
function buildSimulatorTeamsAnswer() {
  return {
    notice: 'Equipes fictícias do simulador, para ensaios: nunca mostrar como resultado real.',
    teams: [
      {
        carNumber: 1,
        teamName: 'Cascavel Off-Road',
        schoolName: 'UNIOESTE',
        city: 'Cascavel',
        state: 'PR',
      },
      {
        carNumber: 2,
        teamName: 'Biguá Off-Road',
        schoolName: 'FURG',
        city: 'Rio Grande',
        state: 'RS',
      },
    ],
  };
}

/** Answers every fetch with the simulator's teams. */
function answerFetchWithTheSimulatorTeams() {
  const fetchStub = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(buildSimulatorTeamsAnswer()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

/** The importEntities the button sends with the two simulator teams. */
function buildImportOfTheSimulatorTeams() {
  return { type: 'importEntities', entityType: 'team', records: buildSimulatorTeamsAnswer().teams };
}

describe('"Importar equipes do simulador"', () => {
  it('imports at once when no team is stored', async () => {
    // Arrange: an empty library, the server ready with the simulator's teams.
    const fetchStub = answerFetchWithTheSimulatorTeams();
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({}),
    );

    // Act: press the button.
    fireEvent.click(screen.getByRole('button', { name: 'Importar equipes do simulador' }));

    // Assert: the teams are asked for and sent as one import.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'one import').toEqual([
        buildImportOfTheSimulatorTeams(),
      ]);
    });
    expect(fetchStub, 'the teams come from the server').toHaveBeenCalledWith(
      '/api/v1/entities/simulator-teams',
    );
    expect(
      screen.getByText('Equipes fictícias, para ensaios.'),
      'labelled fictional',
    ).toBeInTheDocument();
  });

  it('asks first when teams are stored, and imports only once confirmed', async () => {
    // Arrange: teams 42 and 7 stored, the server ready.
    answerFetchWithTheSimulatorTeams();
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo(), buildTeam7()] }),
    );

    // Act: press the button, cancel, press again, confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Importar equipes do simulador' }));
    const isTheQuestionAsked =
      screen.queryByText(
        'Já há 2 equipes cadastradas. As do simulador substituem as de mesmo número de carro. Importar mesmo assim?',
      ) !== null;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const commandsAfterCancelling = fakeServer.listCommandsReceived();
    fireEvent.click(screen.getByRole('button', { name: 'Importar equipes do simulador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar mesmo assim' }));

    // Assert: asked, nothing sent on "Cancelar", the import on "Importar mesmo assim".
    expect(isTheQuestionAsked, 'the question is asked').toBe(true);
    expect(commandsAfterCancelling, 'nothing is sent before the answer').toEqual([]);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the import once confirmed').toEqual([
        buildImportOfTheSimulatorTeams(),
      ]);
    });
  });
});
