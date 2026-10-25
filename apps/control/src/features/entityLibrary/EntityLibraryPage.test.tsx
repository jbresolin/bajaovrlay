/**
 * The "Cadastros" page: its tabs, tables, form and delete (apps/control)
 *
 * What this module is for:
 *   Cadastros (#/cadastros) is where the data operator keeps the entity library
 *   (BAJAOVRLAY-19), on a desktop or a tablet: one tab per kind of record (Equipes,
 *   Pessoas, Patrocinadores, Programação), each a table, a form in a side panel to add or
 *   edit, and "Excluir" in two presses. The page sends commands only; the server stores
 *   the record and sends the slice back.
 *
 * What these tests prove:
 *   - Equipes is shown first, its teams by car number with their logo's thumbnail;
 *     another tab shows its own records.
 *   - "+ Equipe", filled in and saved, sends upsertEntity with the typed team.
 *   - A wrong field is refused under it in pt-BR, and nothing is sent.
 *   - "Editar" fills the form from the team, whose car number cannot be changed there,
 *     and "Salvar" sends the changed team with its logo.
 *   - "Logo sobre placa clara" shows team 42's logo on the on-air panel and on the light
 *     plate side by side, so the operator sees why to tick it; ticked and saved, the team
 *     goes with the choice (BAJAOVRLAY-24). A team with no logo says to send one first.
 *   - "Excluir" asks twice: the first press sends nothing, the second deleteEntity.
 *   - Programação lists the slots by start with what each is now: concluída, em
 *     andamento, a seguir.
 *   - The images' count and folder size are shown, and "Limpar imagens sem uso" deletes
 *     only the images no record names.
 *
 * What these tests deliberately do not cover:
 *   - CSV import and export; EntityCsvImportPanel.test.tsx and entityCsv*.test.ts.
 *   - Uploading an image; EntityImageField.test.tsx.
 *   - "Importar equipes do simulador"; SimulatorTeamsImportButton.test.tsx.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildDiamanteSponsor,
  buildLogoOfTeam42,
  buildNarrator,
  buildSaturdaySchedule,
  buildSlicesWithTheLibrary,
  buildTeam7,
  buildTeam42WithItsLogo,
  buildUnusedCarPhoto,
  logoOfTeam42MediaId,
  unusedCarPhotoMediaId,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** Draws the page with teams 42 and 7, the narrator, the Diamante sponsor and the schedule. */
function renderPageWithTheLibrary() {
  return renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({
      teams: [buildTeam42WithItsLogo(), buildTeam7()],
      people: [buildNarrator()],
      sponsors: [buildDiamanteSponsor()],
      scheduleSlots: buildSaturdaySchedule(),
      media: [buildLogoOfTeam42(), buildUnusedCarPhoto()],
    }),
  );
}

/** Opens a dropdown and picks one of its options (the options list opens in a portal). */
function chooseOptionInDropdown(dropdown: HTMLElement, optionLabel: string): void {
  fireEvent.keyDown(dropdown, { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

/** The rows of the table of a tab, header row left out. */
function readRowsOfTable(tableName: string) {
  const table = screen.getByRole('table', { name: tableName });
  return within(table).getAllByRole('row').slice(1);
}

describe('the tabs', () => {
  it('shows the teams first, by car number, with the logo of team 42', () => {
    // Arrange and act: draw the page.
    renderPageWithTheLibrary();

    // Assert: car 7 before car 42, and team 42's logo drawn from the media store.
    const rows = readRowsOfTable('Equipes cadastradas');
    expect(
      rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent),
      'by car',
    ).toEqual(['7', '42']);
    expect(
      within(rows[1] as HTMLElement).getByRole('img', { name: 'Logo atual' }),
      "team 42's logo is shown",
    ).toHaveAttribute('src', `/media/${logoOfTeam42MediaId}`);
  });

  it('shows the people on their own tab', () => {
    // Arrange: the page drawn.
    renderPageWithTheLibrary();

    // Act: open Pessoas.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas' }));

    // Assert: the narrator, with his role.
    const rows = readRowsOfTable('Pessoas cadastradas');
    expect(rows[0]?.textContent, 'the narrator').toContain('João Bresolin');
    expect(rows[0]?.textContent, 'with his role').toContain('Narrador');
  });
});

describe('the form', () => {
  it('sends upsertEntity with a team typed into "+ Equipe"', async () => {
    // Arrange: the page drawn, the empty form open.
    const { fakeServer } = renderPageWithTheLibrary();
    fireEvent.click(screen.getByRole('button', { name: '+ Equipe' }));
    const form = within(screen.getByRole('form', { name: 'Nova equipe' }));

    // Act: type team 13 and save.
    fireEvent.change(form.getByLabelText('Número do carro'), { target: { value: '13' } });
    fireEvent.change(form.getByLabelText('Nome da equipe'), {
      target: { value: 'Mutum Off-Road' },
    });
    fireEvent.change(form.getByLabelText('Escola (sigla)'), { target: { value: 'UEL' } });
    fireEvent.change(form.getByLabelText('Cidade (opcional)'), { target: { value: 'Londrina' } });
    chooseOptionInDropdown(form.getByRole('combobox', { name: 'UF' }), 'PR');
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: one upsertEntity with the team.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the typed team').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'team',
          record: {
            carNumber: 13,
            teamName: 'Mutum Off-Road',
            schoolName: 'UEL',
            city: 'Londrina',
            state: 'PR',
          },
        },
      ]);
    });
  });

  it('shows a blank name refused under its field and sends nothing', async () => {
    // Arrange: the page drawn, the empty form open, everything but the name typed.
    const { fakeServer } = renderPageWithTheLibrary();
    fireEvent.click(screen.getByRole('button', { name: '+ Equipe' }));
    const form = within(screen.getByRole('form', { name: 'Nova equipe' }));
    fireEvent.change(form.getByLabelText('Número do carro'), { target: { value: '13' } });
    fireEvent.change(form.getByLabelText('Escola (sigla)'), { target: { value: 'UEL' } });
    fireEvent.change(form.getByLabelText('Cidade (opcional)'), { target: { value: 'Londrina' } });
    chooseOptionInDropdown(form.getByRole('combobox', { name: 'UF' }), 'PR');

    // Act: save.
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: the shared sentence under the name, and no command.
    expect(
      await form.findByText('Nome da equipe: obrigatório.'),
      'the reason is shown',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'nothing is sent').toEqual([]);
  });

  it('edits team 42, its car number locked and its logo kept', async () => {
    // Arrange: the page drawn.
    const { fakeServer } = renderPageWithTheLibrary();
    const rowOfTeam42 = readRowsOfTable('Equipes cadastradas')[1] as HTMLElement;

    // Act: "Editar" on team 42, rename it, save.
    fireEvent.click(within(rowOfTeam42).getByRole('button', { name: 'Editar' }));
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 42 (Baja UFPR)' }));
    fireEvent.change(form.getByLabelText('Nome da equipe'), {
      target: { value: 'Baja UFPR Racing' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: the number cannot be typed over; the team goes with its logo.
    expect(form.getByLabelText('Número do carro'), 'the key is locked').toBeDisabled();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the renamed team, logo included').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'team',
          record: { ...buildTeam42WithItsLogo(), teamName: 'Baja UFPR Racing' },
        },
      ]);
    });
  });
});

describe('the light plate of a logo', () => {
  it('shows team 42’s logo on the panel and on the plate, and saves the box ticked', async () => {
    // Arrange: the page drawn, team 42's form open.
    const { fakeServer } = renderPageWithTheLibrary();
    const rowOfTeam42 = readRowsOfTable('Equipes cadastradas')[1] as HTMLElement;
    fireEvent.click(within(rowOfTeam42).getByRole('button', { name: 'Editar' }));
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 42 (Baja UFPR)' }));

    // Act: tick the box and save.
    fireEvent.click(form.getByRole('checkbox', { name: 'Logo sobre placa clara' }));
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: both previews show the logo; the team goes with its logo on the plate.
    expect(
      form.getByRole('img', { name: 'Logo no painel, como vai ao ar sem a placa' }),
      'the logo on the panel',
    ).toHaveAttribute('src', `/media/${logoOfTeam42MediaId}`);
    expect(
      form.getByRole('img', { name: 'Logo na placa clara' }),
      'the logo on the plate',
    ).toHaveAttribute('src', `/media/${logoOfTeam42MediaId}`);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'team 42 with its logo on the plate').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'team',
          record: { ...buildTeam42WithItsLogo(), logoOnLightPlate: true },
        },
      ]);
    });
  });

  it('asks for the logo first on a team that has none', () => {
    // Arrange: the page drawn.
    renderPageWithTheLibrary();
    const rowOfTeam7 = readRowsOfTable('Equipes cadastradas')[0] as HTMLElement;

    // Act: open team 7's form (no logo).
    fireEvent.click(within(rowOfTeam7).getByRole('button', { name: 'Editar' }));

    // Assert: no preview, and a line saying what to do.
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 7 (Juriti Off-Road)' }));
    expect(
      form.getByText('Envie o logo para ver como ele fica no painel e na placa clara.'),
      'the operator is told to send the logo first',
    ).toBeInTheDocument();
    expect(form.queryByRole('img', { name: 'Logo na placa clara' }), 'no preview').toBeNull();
  });
});

describe('"Excluir"', () => {
  it('asks twice, then sends deleteEntity for that car', () => {
    // Arrange: the page drawn.
    const { fakeServer } = renderPageWithTheLibrary();
    const rowOfTeam7 = within(readRowsOfTable('Equipes cadastradas')[0] as HTMLElement);

    // Act: press "Excluir", note what was sent, then confirm.
    fireEvent.click(rowOfTeam7.getByRole('button', { name: 'Excluir' }));
    const commandsAfterTheFirstPress = fakeServer.listCommandsReceived();
    fireEvent.click(rowOfTeam7.getByRole('button', { name: 'Confirmar: excluir' }));

    // Assert: nothing at the first press, the delete at the second.
    expect(commandsAfterTheFirstPress, 'one press must not delete').toEqual([]);
    expect(fakeServer.listCommandsReceived(), 'the second press deletes car 7').toEqual([
      { type: 'deleteEntity', entityType: 'team', carNumber: 7 },
    ]);
  });
});

describe('Programação', () => {
  it('lists the slots by start with what each is at 12:00', () => {
    // Arrange: the page clock at noon on Saturday, the page drawn.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0));
    renderPageWithTheLibrary();

    // Act: open Programação.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Programação' }));

    // Assert: briefing, enduro, awards, with their status at noon.
    const rows = readRowsOfTable('Sessões da programação');
    expect(
      rows.map((row) => {
        const cells = within(row).getAllByRole('cell');
        return [cells[1]?.textContent, cells[4]?.textContent];
      }),
      'by start, with the status of now',
    ).toEqual([
      ['Briefing das equipes', 'concluída'],
      ['Enduro de Resistência', 'em andamento'],
      ['Premiação', 'a seguir'],
    ]);
    vi.useRealTimers();
  });
});

describe('the images', () => {
  it('shows the count and size, and cleans only the images no record names', () => {
    // Arrange: team 42's logo (in use) and an old car photo (unused), 3,5 MB in all.
    const { fakeServer } = renderPageWithTheLibrary();

    // Act: press "Limpar imagens sem uso".
    const summary = screen.getByText('2 imagens · 3,5 MB');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar imagens sem uso (1)' }));

    // Assert: the summary was there, and only the old photo is deleted.
    expect(summary, 'the count and size').toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'the unused image only').toEqual([
      { type: 'deleteMedia', mediaId: unusedCarPhotoMediaId },
    ]);
  });
});
