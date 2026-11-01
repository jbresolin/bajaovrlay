/**
 * "Importar equipes do app Baja" on the Equipes tab (apps/control)
 *
 * What this module is for:
 *   Cadastros gets an event's teams from the Baja app's results API (BAJAOVRLAY-54). The
 *   operator types the event id; the page reads equipes.php through the server's sample
 *   route (the browser never calls the API), writes the teams as the Equipes CSV
 *   (bajaAppTeamsAsCsv.ts) and opens "Importar CSV" with it, so the preview, its "novo",
 *   "atualiza" and "erro", and the one importEntities are the CSV import's own.
 *
 * What these tests prove:
 *   - The real 26SE teams, read through the route, open the CSV import with their full
 *     names (26SE has no short names), and "Importar 7 linhas válidas" sends one
 *     importEntities with Minerva Baja as "UFRJ"; a full school over 30 letters is "erro"
 *     with the schema's sentence, for the operator to shorten in the box.
 *   - A stored team is an update that keeps its logo and the short names its operator
 *     typed, since the app has none.
 *   - The route's sentence is shown when the teams cannot be read, and no import opens.
 *
 * What these tests deliberately do not cover:
 *   - Each cell's rule: bajaAppTeamsAsCsv.test.ts.
 *   - The CSV preview's own rules: entityCsvImport.test.ts and EntityCsvImportPanel.test.tsx.
 */
import type { Team } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  bajaAppAnswers,
  createSampleRouteAnswering,
  listPostedSampleRequests,
} from '@/features/dataSources/bajaAppSource/bajaAppSampleRoute.testSupport';
import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  logoOfTeam42MediaId,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** Team 1 of 26SE as its operator stored it: short names typed, and a logo. */
function buildStoredTuffaoWithALogo(): Team {
  return {
    carNumber: 1,
    teamName: 'Tuffão',
    schoolName: 'UFF',
    city: 'Niterói',
    state: 'RJ',
    logoMediaId: logoOfTeam42MediaId,
  };
}

/** Presses the button, types the event id and asks for its teams. */
function readTheTeamsOf(eventId: string): void {
  pressButton('Importar equipes do app Baja');
  typeIntoField('Código do evento no app Baja', eventId);
  pressButton('Buscar equipes');
}

/** The preview's rows, each as its car's cells: line, status, record, reason. */
function findPreviewRowOfLine(lineNumber: number) {
  const preview = within(screen.getByRole('table', { name: 'Prévia da importação' }));
  const row = preview
    .getAllByRole('row')
    .find(
      (candidate) =>
        within(candidate).queryAllByRole('cell')[0]?.textContent === String(lineNumber),
    );
  return row === undefined
    ? []
    : within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
}

describe('"Importar equipes do app Baja"', () => {
  it('opens the CSV import with the 26SE teams and imports the valid lines as one command', async () => {
    // Arrange: an empty library, the sample route answering the real 26SE teams.
    const sampleRoute = createSampleRouteAnswering({ 'equipes.php': bajaAppAnswers.teams26SE });
    vi.stubGlobal('fetch', sampleRoute);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({}),
    );

    // Act: read 26SE's teams, wait for the preview, and import the valid lines.
    readTheTeamsOf('26SE');
    await screen.findByText('26 equipes de 26SE lidas. Confira a prévia e importe.');
    const lineOfTuffao = findPreviewRowOfLine(2);
    pressButton('Importar 7 linhas válidas');

    // Assert: read through the route; Tuffão refused for its long school; one import of
    // the seven valid teams, Minerva Baja under its own names.
    expect(listPostedSampleRequests(sampleRoute), 'the teams, read by the server').toEqual([
      {
        requestId: 'equipes',
        url: 'https://api.bajasaebrasil.net/resultados/equipes.php',
        headers: [],
        queryParameters: [{ name: 'evt', value: '26SE' }],
      },
    ]);
    expect(lineOfTuffao.slice(1, 2), 'a full school over 30 letters is refused').toEqual(['erro']);
    expect(lineOfTuffao[3], 'with the schema’s own sentence').toMatch(/Escola/);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'one import').toHaveLength(1);
    });
    const [importCommand] = fakeServer.listCommandsReceived() as Array<{
      type: string;
      entityType: string;
      records: Team[];
    }>;
    expect(importCommand?.type, 'the CSV import’s command').toBe('importEntities');
    expect(importCommand?.records, 'the seven valid teams').toHaveLength(7);
    expect(
      importCommand?.records.find((team) => team.carNumber === 22),
      'Minerva Baja by its full names',
    ).toEqual({
      carNumber: 22,
      teamName: 'Minerva Baja',
      schoolName: 'UFRJ',
      schoolFullName: 'UFRJ',
    });
  });

  it('updates a stored team, keeping its logo and the short names its operator typed', async () => {
    // Arrange: Tuffão (team 1) stored with "UFF" and a logo; the route answering 26SE.
    vi.stubGlobal('fetch', createSampleRouteAnswering({ 'equipes.php': bajaAppAnswers.teams26SE }));
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({ teams: [buildStoredTuffaoWithALogo()] }),
    );

    // Act: read 26SE's teams and import the valid lines.
    readTheTeamsOf('26SE');
    await screen.findByText('26 equipes de 26SE lidas. Confira a prévia e importe.');
    const lineOfTuffao = findPreviewRowOfLine(2);
    pressButton('Importar 8 linhas válidas');

    // Assert: Tuffão is an update, sent with its logo, its short names and the app's school.
    expect(lineOfTuffao[1], 'a stored team is an update').toBe('atualiza');
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'one import').toHaveLength(1);
    });
    const [importCommand] = fakeServer.listCommandsReceived() as Array<{ records: Team[] }>;
    expect(
      importCommand?.records.find((team) => team.carNumber === 1),
      'Tuffão keeps its logo and short names',
    ).toEqual({
      carNumber: 1,
      teamName: 'Tuffão',
      schoolName: 'UFF',
      schoolFullName: 'Universidade Federal Fluminense',
      city: 'Niterói',
      state: 'RJ',
      logoMediaId: logoOfTeam42MediaId,
    });
  });

  it('shows the route’s sentence when the teams cannot be read, and opens no import', async () => {
    // Arrange: a sample route that knows no endpoint: every read answers 404.
    vi.stubGlobal('fetch', createSampleRouteAnswering({}));
    renderOnControlPageConnectedToFakeServer(<EntityLibraryPage />, buildSlicesWithTheLibrary({}));

    // Act: ask for the teams of an event that is not there.
    readTheTeamsOf('99XX');

    // Assert: the sentence, and no CSV import.
    expect(
      await screen.findByText('A fonte respondeu 404 (Not Found) em equipes'),
      'the route’s own sentence',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Importar equipes de um CSV' }),
      'no import opens',
    ).toBeNull();
  });

  it('asks for the event id before reading anything', () => {
    // Arrange: the route ready, an empty library.
    const sampleRoute = createSampleRouteAnswering({ 'equipes.php': bajaAppAnswers.teams26SE });
    vi.stubGlobal('fetch', sampleRoute);
    renderOnControlPageConnectedToFakeServer(<EntityLibraryPage />, buildSlicesWithTheLibrary({}));

    // Act: open it and press "Buscar equipes" with no event typed.
    pressButton('Importar equipes do app Baja');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar equipes' }));

    // Assert: the sentence, and nothing read.
    expect(screen.getByText('Digite o código do evento.'), 'the id is asked for').toBeVisible();
    expect(sampleRoute, 'nothing read').not.toHaveBeenCalled();
  });
});
