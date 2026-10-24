/**
 * Cadastros opened over plain http on the LAN (apps/control)
 *
 * What this module is for:
 *   At the event a tablet opens the control page as http://<server>:3000, where the
 *   browser offers no crypto.randomUUID. At gate 2 of PR #23 "+ Equipe" and "Editar"
 *   blanked the page there, because the form made its new record's id with it. The page
 *   now makes ids with makeRecordId (crypto.getRandomValues), on every address.
 *
 * What these tests prove (with crypto.randomUUID taken away):
 *   - "+ Pessoa" opens its form, and saving sends the person with a made id.
 *   - "Editar" on a team opens its form.
 *   - A pasted people CSV with no ids previews its lines as new, each with a made id.
 *
 * What these tests deliberately do not cover:
 *   - The id itself; recordId.test.ts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam7,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';
import { takeRandomUUIDAwayAsOnPlainHttp } from './plainHttpCrypto.testSupport';

const versionFourUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Cadastros over plain http', () => {
  it('opens "+ Pessoa" and saves the person with a made id', async () => {
    // Arrange: no crypto.randomUUID, the page drawn, Pessoas open.
    takeRandomUUIDAwayAsOnPlainHttp();
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({}),
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas' }));

    // Act: "+ Pessoa", type the narrator, save.
    fireEvent.click(screen.getByRole('button', { name: '+ Pessoa' }));
    const form = within(screen.getByRole('form', { name: 'Nova pessoa' }));
    fireEvent.change(form.getByLabelText('Nome'), { target: { value: 'João Bresolin' } });
    fireEvent.change(form.getByLabelText('Função'), { target: { value: 'Narrador' } });
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: the person goes with an id made without randomUUID.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'one upsert').toHaveLength(1);
    });
    const upsert = fakeServer.listCommandsReceived()[0] as { record: { personId: string } };
    expect(upsert.record.personId, 'a made id').toMatch(versionFourUuid);
  });

  it('opens the form of a team with "Editar"', () => {
    // Arrange: no crypto.randomUUID, team 7 listed.
    takeRandomUUIDAwayAsOnPlainHttp();
    renderOnControlPageConnectedToFakeServer(
      <EntityLibraryPage />,
      buildSlicesWithTheLibrary({ teams: [buildTeam7()] }),
    );

    // Act: "Editar" on team 7.
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    // Assert: the form is drawn, not a blank page.
    expect(
      screen.getByRole('form', { name: 'Editar: Equipe 7 (Juriti Off-Road)' }),
      'the form opens',
    ).toBeInTheDocument();
  });

  it('previews a people CSV with no ids, each line with a made id', () => {
    // Arrange: no crypto.randomUUID, Pessoas' import panel open.
    takeRandomUUIDAwayAsOnPlainHttp();
    renderOnControlPageConnectedToFakeServer(<EntityLibraryPage />, buildSlicesWithTheLibrary({}));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pessoas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));

    // Act: paste two people with no id.
    fireEvent.change(screen.getByLabelText('Cole o CSV aqui'), {
      target: { value: 'id;nome;funcao\n;João Bresolin;Narrador\n;Carla Menezes;Juíza\n' },
    });

    // Assert: both lines are new.
    const previewRows = within(screen.getByRole('table', { name: 'Prévia da importação' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    expect(previewRows, 'two new people').toEqual(['novo', 'novo']);
  });
});
