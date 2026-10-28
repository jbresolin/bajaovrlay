/**
 * "Salvar" of a Cadastros form waits for an image that is still uploading (apps/control)
 *
 * What this module is for:
 *   An image field uploads its file the moment it is chosen, and the form keeps the media
 *   id the server answers (EntityImageField.tsx). Until that answer comes, the form does
 *   not have the new image yet, so a save pressed then would store the record without it.
 *   On a slow network at the track that is a real way to lose a logo (BAJAOVRLAY-51).
 *
 * What these tests prove:
 *   - While the upload runs, "Salvar" is off and reads "Enviando imagem…"; once it is
 *     stored, "Salvar" is back and the saved team names the new logo.
 *   - When the upload fails, "Salvar" is back too, the failure is shown, and the team is
 *     saved with the logo it had.
 *   - Submitting the form during the upload (Enter in a field) sends nothing: the guard is
 *     in the submit handler, not only on the button.
 *
 * What these tests deliberately do not cover:
 *   - The upload itself, a refusal's wording and "Remover"; EntityImageField.test.tsx.
 *   - The same race in a real browser; the podium walk (podiumBattleQrWalk.e2e.ts) presses
 *     "Salvar" right after choosing car 1's logo.
 */
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

/** The media id the store gives the new logo. */
const newLogoMediaId = 'c2e4a6b8d0f2c4e6a8b0d2f4c6e8a0b2d4f6c8e0a2b4d6f8c0e2a4b6d8f0c2e4';

/**
 * Stubs fetch with an upload the test holds open: it answers only when the test calls
 * one of the two releases, as a slow network would.
 */
function holdTheUploadOpenUntilReleased() {
  let answerTheUpload: (response: Response) => void = () => undefined;
  let failTheUpload: (reason: Error) => void = () => undefined;
  const uploadStillRunning = new Promise<Response>((resolve, reject) => {
    answerTheUpload = resolve;
    failTheUpload = reject;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => uploadStillRunning),
  );
  return {
    releaseWithTheStoredLogo: () => {
      answerTheUpload(
        new Response(
          JSON.stringify({
            mediaId: newLogoMediaId,
            contentType: 'image/png',
            widthPx: 256,
            heightPx: 256,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    },
    releaseWithTheNetworkDown: () => {
      failTheUpload(new Error('Failed to fetch'));
    },
  };
}

/** Draws Cadastros with teams 7 and 42 and opens the form of the team of `carNumber`. */
function openTheFormOfTeam(carNumber: number, formName: string) {
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
  const form = screen.getByRole('form', { name: formName });
  return { fakeServer: controlPage.fakeServer, form, inForm: within(form) };
}

/** A small PNG file, as the operator's file picker hands it. */
function buildLogoFile(): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo-nova.png', {
    type: 'image/png',
  });
}

describe('"Salvar" while an image uploads', () => {
  it('is off and reads "Enviando imagem…" until the logo is stored, then saves the new logo', async () => {
    // Arrange: team 7's form open, and an upload that will not answer until released.
    const upload = holdTheUploadOpenUntilReleased();
    const { fakeServer, inForm } = openTheFormOfTeam(7, 'Editar: Equipe 7 (Juriti Off-Road)');

    // Act: choose the logo, and look at the save button while the upload runs.
    fireEvent.change(inForm.getByLabelText('Logo'), { target: { files: [buildLogoFile()] } });
    const saveButtonDuringTheUpload = inForm.getByRole('button', { name: 'Enviando imagem…' });

    // Assert: it cannot be pressed while the form does not hold the logo yet.
    expect(saveButtonDuringTheUpload, '"Salvar" is off during the upload').toBeDisabled();

    // Act: the upload is stored, and the operator saves.
    upload.releaseWithTheStoredLogo();
    await inForm.findByRole('img', { name: 'Logo atual' });
    const saveButtonAfterTheUpload = inForm.getByRole('button', { name: 'Salvar' });
    fireEvent.click(saveButtonAfterTheUpload);

    // Assert: the button was back, and the saved team names the new logo.
    expect(saveButtonAfterTheUpload, '"Salvar" is back once the logo is stored').toBeEnabled();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the team is saved with the new logo').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'team',
          record: { ...buildTeam7(), logoMediaId: newLogoMediaId },
        },
      ]);
    });
  });

  it('comes back on when the upload fails, and the team keeps the logo it had', async () => {
    // Arrange: team 42's form open with its logo, and an upload that will not answer until released.
    const upload = holdTheUploadOpenUntilReleased();
    const { fakeServer, inForm } = openTheFormOfTeam(42, 'Editar: Equipe 42 (Baja UFPR)');

    // Act: choose a new logo, and look at the save button while the upload runs.
    fireEvent.change(inForm.getByLabelText('Logo'), { target: { files: [buildLogoFile()] } });
    const saveButtonDuringTheUpload = inForm.getByRole('button', { name: 'Enviando imagem…' });

    // Assert: off while the upload runs.
    expect(saveButtonDuringTheUpload, '"Salvar" is off during the upload').toBeDisabled();

    // Act: the network fails under the upload, and the operator saves.
    upload.releaseWithTheNetworkDown();
    const failure = await inForm.findByText(
      'Não foi possível enviar a imagem: o servidor não respondeu.',
    );
    const saveButtonAfterTheFailure = inForm.getByRole('button', { name: 'Salvar' });
    fireEvent.click(saveButtonAfterTheFailure);

    // Assert: the failure is shown, "Salvar" was back, and the team keeps its old logo.
    expect(failure, 'the upload failure is shown as today').toBeInTheDocument();
    expect(saveButtonAfterTheFailure, '"Salvar" is back after a failed upload').toBeEnabled();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the team is saved with its old logo').toEqual([
        { type: 'upsertEntity', entityType: 'team', record: buildTeam42WithItsLogo() },
      ]);
    });
  });

  it('sends no command when the form is submitted during the upload (Enter in a field)', async () => {
    // Arrange: team 7's form open, and an upload that will not answer until released.
    const upload = holdTheUploadOpenUntilReleased();
    const { fakeServer, form, inForm } = openTheFormOfTeam(7, 'Editar: Equipe 7 (Juriti Off-Road)');

    // Act: choose the logo, then submit the form straight away, as Enter in "Nome" does;
    // a submit event reaches the handler even with the button off. Then let the upload end.
    fireEvent.change(inForm.getByLabelText('Logo'), { target: { files: [buildLogoFile()] } });
    fireEvent.submit(form);
    upload.releaseWithTheStoredLogo();
    await inForm.findByRole('img', { name: 'Logo atual' });

    // Assert: nothing was saved; the operator saves once the logo is in.
    expect(fakeServer.listCommandsReceived(), 'no save during the upload').toEqual([]);
  });
});
