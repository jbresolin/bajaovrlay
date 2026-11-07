/**
 * The item editor's save buttons wait for an image that is still uploading (apps/control)
 *
 * What this module is for:
 *   A graphic's image field in the item editor (a sponsor's logo) uploads its file the
 *   moment it is chosen, and the form holds the image's address once the server answers
 *   (ImageUrlFieldControl.tsx, which reuses the Cadastros image field). Until then the
 *   form still holds the old image, so "Salvar e disparar" pressed during the upload would
 *   put the graphic on air without the new one (BAJAOVRLAY-51, as in Cadastros).
 *
 * What these tests prove:
 *   - While the upload runs, all four buttons that save the item ("Salvar item", "Salvar e
 *     disparar", "Salvar e prévia", "Atualizar no ar") are off and read "Enviando
 *     imagem…"; once it is stored, "Salvar e disparar" saves the new logo, then takes.
 *   - Enter in a field during the upload sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - A failed upload, and Cadastros; EntityRecordFormPanelWaitsForUploads.test.tsx.
 *   - What each button sends otherwise; ItemEditorPanelSaveAndUse.test.tsx and the
 *     other ItemEditorPanel tests.
 */
import type { Graphic, Item, Slices } from '@bajaovrlay/shared';
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForCommandsReceived,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

/** The media id of Bosch's logo, the one the stored item shows. */
const boschLogoMediaId = buildFakeMediaId(4);

/** The media id the store gives the new logo, Marcopolo's. */
const marcopoloLogoMediaId = buildFakeMediaId(5);

/**
 * A sponsor bug as the server would register it: a caption and the sponsor's logo, an
 * image field (`v_baja.role: imageUrl`), on the "Logo" layer. Built here because the
 * control page does not depend on the real package; the two fields are the real ones.
 */
function buildSponsorBugGraphic(): Graphic {
  return {
    id: 'sponsor-bug',
    manifest: {
      id: 'baja-sponsor-bug',
      name: 'Bug do patrocinador',
      main: 'sponsor-bug.js',
      schema: {
        type: 'object',
        properties: {
          caption: { type: 'string', title: 'Legenda' },
          sponsorLogoUrl: {
            type: 'string',
            title: 'Logo do patrocinador',
            v_baja: { role: 'imageUrl' },
          },
        },
        additionalProperties: false,
      },
    },
    defaultLayerId: 'bug',
    category: 'bug',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The sponsor bug item of the main session, showing Bosch's logo. */
function buildBoschSponsorBugItem(): Item {
  return {
    id: '9a4c2e6f-1b3d-4f58-8a7c-0e2d4f6b8a1c',
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'sponsor-bug',
    layerId: 'bug',
    fields: {
      caption: { kind: 'literal', value: 'Apresentado por' },
      sponsorLogoUrl: { kind: 'literal', value: `/media/${boschLogoMediaId}` },
    },
    label: 'Bug Bosch',
    color: 'info',
    notes: '',
  };
}

/** The page's slices with the sponsor bug item stored and on air, so "Atualizar no ar" shows. */
function buildSlicesWithTheBoschBugOnAir(item: Item): Slices {
  const slices = buildSlicesWithTheRaceClockAndTheLowerThird();
  return {
    ...slices,
    graphics: [...slices.graphics, buildSponsorBugGraphic()],
    items: [item],
    instances: [
      buildInstanceTakenFromItem({
        id: '2c6e8a0b-4d1f-4a37-9b5c-7e1a3c5d9f20',
        item,
        layerId: 'bug',
        target: 'program',
        takenAt: '2026-10-10T13:00:00.000Z',
      }),
    ],
  };
}

/**
 * Stubs fetch with an upload the test holds open: it answers only when the test
 * releases it, as a slow network at the track would.
 */
function holdTheUploadOpenUntilReleased() {
  let answerTheUpload: (response: Response) => void = () => undefined;
  const uploadStillRunning = new Promise<Response>((resolve) => {
    answerTheUpload = resolve;
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
            mediaId: marcopoloLogoMediaId,
            contentType: 'image/png',
            widthPx: 512,
            heightPx: 512,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    },
  };
}

/** Marcopolo's logo as a PNG file, as the operator's file picker hands it. */
function buildMarcopoloLogoFile(): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo-marcopolo.png', {
    type: 'image/png',
  });
}

/** Waits until the logo's thumbnail is the new one: the upload's answer is in the form. */
async function waitForTheMarcopoloThumbnail(): Promise<void> {
  await waitFor(() => {
    expect(
      screen.getByRole('img', { name: 'Logo do patrocinador atual' }),
      'the thumbnail shows the new logo',
    ).toHaveAttribute('src', `/media/${marcopoloLogoMediaId}`);
  });
}

describe('the item editor while an image uploads', () => {
  it('keeps all four save buttons off with "Enviando imagem…", then "Salvar e disparar" sends the new logo', async () => {
    // Arrange: the Bosch bug, on air, open in the editor; an upload that waits to be released.
    const upload = holdTheUploadOpenUntilReleased();
    const item = buildBoschSponsorBugItem();
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      item,
      buildSlicesWithTheBoschBugOnAir(item),
    );

    // Act: choose Marcopolo's logo, and look at the buttons while the upload runs.
    fireEvent.change(screen.getByLabelText('Logo do patrocinador'), {
      target: { files: [buildMarcopoloLogoFile()] },
    });
    const buttonsDuringTheUpload = screen.getAllByRole('button', { name: 'Enviando imagem…' });

    // Assert: the four buttons that save the item all wait, and none can be pressed.
    expect(buttonsDuringTheUpload, 'all four save buttons read "Enviando imagem…"').toHaveLength(4);
    for (const button of buttonsDuringTheUpload) {
      expect(button, 'a save button is off during the upload').toBeDisabled();
    }
    expect(
      screen.queryByRole('button', { name: 'Salvar e disparar' }),
      'no button still offers to put the graphic on air',
    ).not.toBeInTheDocument();

    // Act: the upload is stored, the operator presses "Salvar e disparar", and the server
    // accepts the save, then the take.
    upload.releaseWithTheStoredLogo();
    await waitForTheMarcopoloThumbnail();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e disparar' }));
    await waitForCommandsReceived(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Assert: the item is saved with the new logo, then taken.
    expect(
      fakeServer.listCommandsReceived(),
      'the save carries the new logo, and goes before the take',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: item.id,
        fields: {
          sponsorLogoUrl: { kind: 'literal', value: `/media/${marcopoloLogoMediaId}` },
        },
      },
      { type: 'takeItem', itemId: item.id },
    ]);
  });

  it('sends no command when Enter is pressed in a field during the upload', async () => {
    // Arrange: the Bosch bug, on air, open in the editor; an upload that waits to be released.
    const upload = holdTheUploadOpenUntilReleased();
    const item = buildBoschSponsorBugItem();
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      item,
      buildSlicesWithTheBoschBugOnAir(item),
    );

    // Act: choose the new logo, then press Enter in "Legenda", which submits the form the
    // field is in (sent here from the field, as the browser does); then the upload ends.
    fireEvent.change(screen.getByLabelText('Logo do patrocinador'), {
      target: { files: [buildMarcopoloLogoFile()] },
    });
    fireEvent.submit(screen.getByLabelText('Legenda'));
    upload.releaseWithTheStoredLogo();
    await waitForTheMarcopoloThumbnail();

    // Assert: nothing was saved and nothing went on air.
    expect(fakeServer.listCommandsReceived(), 'no command during the upload').toEqual([]);
  });
});
