/**
 * An image field of a Cadastros form: upload at once, thumbnail, "Trocar", "Remover"
 * (apps/control)
 *
 * What this module is for:
 *   A logo, a car photo or a person's photo is chosen (or dropped) in the form and sent
 *   to the media store at once (POST /api/v1/media); the form keeps the media id the
 *   server answers and shows the image as a thumbnail (BAJAOVRLAY-19). "Trocar" picks
 *   another file; "Remover" takes the image off the record (the file stays in the store
 *   until "Limpar imagens sem uso"). The record is saved with "Salvar", like any field.
 *
 * What these tests prove:
 *   - Choosing a file uploads it and shows the thumbnail from /media/<mediaId>, and the
 *     team saved afterwards names that media id.
 *   - A file the server refuses shows the server's pt-BR reason, and no thumbnail.
 *   - "Remover" takes the logo off: the team is saved without it.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with the file; the media tests of apps/server.
 */
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildLogoOfTeam42,
  buildSlicesWithTheLibrary,
  buildTeam7,
  buildTeam42WithItsLogo,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** The media id the store gives the new logo of team 7. */
const newLogoOfTeam7MediaId = buildFakeMediaId(1);

/** Answers every fetch with this status and JSON body, as the server would. */
function answerEveryFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

/** Draws the page with teams 7 and 42 and opens the form of the team of `carNumber`. */
function openTheFormOfTeam(carNumber: number) {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({
      teams: [buildTeam42WithItsLogo(), buildTeam7()],
      media: [buildLogoOfTeam42()],
    }),
  );
  const table = screen.getByRole('table', { name: 'Equipes cadastradas' });
  const row = within(table).getByRole('row', { name: new RegExp(`^${String(carNumber)} `) });
  fireEvent.click(within(row).getByRole('button', { name: 'Editar' }));
  return controlPage;
}

/** A small PNG file, as the operator's file picker hands it. */
function buildLogoFile(): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo-juriti.png', {
    type: 'image/png',
  });
}

describe('an image field', () => {
  it('uploads a chosen file at once and shows its thumbnail, saved with the team', async () => {
    // Arrange: team 7's form open, the server ready to answer the upload.
    const fetchStub = answerEveryFetchWith(200, {
      mediaId: newLogoOfTeam7MediaId,
      contentType: 'image/png',
      widthPx: 256,
      heightPx: 256,
    });
    const { fakeServer } = openTheFormOfTeam(7);
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 7 (Juriti Off-Road)' }));

    // Act: choose the logo, wait for the thumbnail, then save.
    fireEvent.change(form.getByLabelText('Logo'), { target: { files: [buildLogoFile()] } });
    const thumbnail = await form.findByRole('img', { name: 'Logo atual' });
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: posted to the media store, drawn from it, and named in the saved team.
    expect(fetchStub, 'the file goes to the media store').toHaveBeenCalledWith(
      '/api/v1/media',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(thumbnail, 'the thumbnail comes from the media store').toHaveAttribute(
      'src',
      `/media/${newLogoOfTeam7MediaId}`,
    );
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the team names the new logo').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'team',
          record: { ...buildTeam7(), logoMediaId: newLogoOfTeam7MediaId },
        },
      ]);
    });
  });

  it("shows the server's reason for a file it refuses, and no thumbnail", async () => {
    // Arrange: team 7's form open, the server refusing the file.
    answerEveryFetchWith(415, {
      error: {
        code: 'MEDIA_TYPE_NOT_ACCEPTED',
        message: 'O arquivo "logo.exe" não é uma imagem PNG, JPEG, WebP ou SVG.',
      },
    });
    openTheFormOfTeam(7);
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 7 (Juriti Off-Road)' }));

    // Act: choose the file.
    fireEvent.change(form.getByLabelText('Logo'), { target: { files: [buildLogoFile()] } });

    // Assert: the server's sentence, and still no logo.
    expect(
      await form.findByText('O arquivo "logo.exe" não é uma imagem PNG, JPEG, WebP ou SVG.'),
      'the refusal is shown',
    ).toBeInTheDocument();
    expect(form.queryByRole('img', { name: 'Logo atual' }), 'no thumbnail').not.toBeInTheDocument();
  });

  it('takes the logo off with "Remover", and saves the team without it', async () => {
    // Arrange: team 42's form open, its logo shown.
    const { fakeServer } = openTheFormOfTeam(42);
    const form = within(screen.getByRole('form', { name: 'Editar: Equipe 42 (Baja UFPR)' }));

    // Act: remove the logo, save.
    fireEvent.click(form.getByRole('button', { name: 'Remover' }));
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: the team goes without its logo.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the team without its logo').toHaveLength(1);
    });
    expect(fakeServer.listCommandsReceived(), 'the record has no logo').toEqual([
      {
        type: 'upsertEntity',
        entityType: 'team',
        record: {
          carNumber: 42,
          teamName: 'Baja UFPR',
          schoolName: 'UFPR',
          schoolFullName: 'Universidade Federal do Paraná',
          city: 'Curitiba',
          state: 'PR',
        },
      },
    ]);
  });
});
