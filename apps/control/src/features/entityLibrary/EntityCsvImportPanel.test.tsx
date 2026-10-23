/**
 * "Importar CSV" on a Cadastros tab: the preview and the import (apps/control)
 *
 * What this module is for:
 *   The import panel takes a CSV pasted or chosen from a file, shows the preview of every
 *   line ("novo", "atualiza", "erro" with its line and pt-BR reason) and, on "Importar",
 *   sends the valid lines only, as one importEntities (BAJAOVRLAY-19). It also lists the
 *   tab's columns, says images are not in the CSV, and offers the example file and the
 *   export.
 *
 * What these tests prove:
 *   - A pasted CSV with a new car, a stored car and a bad line shows the three statuses
 *     with their lines and the reason.
 *   - "Importar" sends one importEntities with the two valid teams.
 *   - "Exportar CSV" hands the browser the teams as a file named equipes.csv.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of reading a line; entityCsvImport.test.ts.
 *   - What the server does with the import; the entity tests of apps/server.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam42WithItsLogo,
  logoOfTeam42MediaId,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** A teams CSV with car 7 (new), car 42 (stored) and car 13 with a bad state. */
const teamsCsvWithThreeLines =
  'carro;equipe;escola;cidade;uf\n' +
  '7;Juriti Off-Road;UDESC;Joinville;SC\n' +
  '42;Baja UFPR Racing;UFPR;Curitiba;PR\n' +
  '13;Mutum Off-Road;UEL;Londrina;Paraná\n';

/** Draws the page with team 42 and opens the teams' import panel. */
function openTheTeamsImportPanel() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo()] }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
  return controlPage;
}

describe('the CSV import panel', () => {
  it('shows each line as novo, atualiza or erro, with its line and reason', () => {
    // Arrange: the panel open.
    openTheTeamsImportPanel();

    // Act: paste the CSV.
    fireEvent.change(screen.getByLabelText('Cole o CSV aqui'), {
      target: { value: teamsCsvWithThreeLines },
    });

    // Assert: one preview row per line, in order.
    const previewRows = within(screen.getByRole('table', { name: 'Prévia da importação' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(previewRows, 'what each line would do').toEqual([
      ['2', 'novo', 'Equipe 7 (Juriti Off-Road)', ''],
      ['3', 'atualiza', 'Equipe 42 (Baja UFPR Racing)', ''],
      [
        '4',
        'erro',
        '13 · Mutum Off-Road · UEL · Londrina · Paraná',
        'UF: use a sigla de um estado brasileiro (por exemplo PR, SP ou DF).',
      ],
    ]);
  });

  it('imports the two valid lines as one importEntities', () => {
    // Arrange: the panel open, the CSV pasted.
    const { fakeServer } = openTheTeamsImportPanel();
    fireEvent.change(screen.getByLabelText('Cole o CSV aqui'), {
      target: { value: teamsCsvWithThreeLines },
    });

    // Act: press "Importar".
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 linhas válidas' }));

    // Assert: one batch, the bad line left out; car 42's line replaces the stored team
    // (its full school name is not in this CSV) and keeps its logo.
    expect(fakeServer.listCommandsReceived(), 'one import of the valid lines').toEqual([
      {
        type: 'importEntities',
        entityType: 'team',
        records: [
          {
            carNumber: 7,
            teamName: 'Juriti Off-Road',
            schoolName: 'UDESC',
            city: 'Joinville',
            state: 'SC',
          },
          {
            carNumber: 42,
            teamName: 'Baja UFPR Racing',
            schoolName: 'UFPR',
            city: 'Curitiba',
            state: 'PR',
            logoMediaId: logoOfTeam42MediaId,
          },
        ],
      },
    ]);
  });
});

describe('"Exportar CSV"', () => {
  it('hands the browser the teams as equipes.csv', async () => {
    // Arrange: the page with team 42, the browser's download watched.
    renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo()] }),
    );
    const blobsHanded: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobsHanded.push(blob as Blob);
      return 'blob:equipes';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickedLinks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedLinks.push(this);
    });

    // Act: press "Exportar CSV".
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    // Assert: a file named equipes.csv holding team 42.
    expect(clickedLinks[0]?.download, 'the file name').toBe('equipes.csv');
    expect(await blobsHanded[0]?.text(), 'the file holds team 42').toContain(
      '42;Baja UFPR;UFPR;Universidade Federal do Paraná;Curitiba;PR',
    );
    vi.restoreAllMocks();
  });
});
