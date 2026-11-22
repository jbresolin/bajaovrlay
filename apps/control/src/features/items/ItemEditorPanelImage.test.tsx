/**
 * Item editor panel: an item of the "Imagem" graphic (apps/control)
 *
 * What this module is for:
 *   The image graphic (BAJAOVRLAY-84) shows one picture from the media library, sized and
 *   placed by hand. Its form is generated from its manifest like every other graphic's;
 *   the one new rule is "Fundo", a `gddType: "color-rrggbb"` text that the form checks as
 *   a `#rrggbb` colour before anything is sent, since the item editor has no colour
 *   picker (the plainer choice the brief allowed).
 *
 * What these tests prove (with the real image manifest):
 *   - The editor shows the graphic's ten fields under their pt-BR labels, with the item's
 *     values: width, position, offsets (a negative one), opacity, entrance and margin;
 *     the height and the background empty, as an item that leaves them to the file and
 *     to no colour.
 *   - A background that is not a colour ("preto") is refused under the field in pt-BR,
 *     and nothing is sent.
 *   - A background typed in capitals, "#0A0A0A", is saved as "#0a0a0a": the lower case
 *     the OGraf GDD's pattern takes.
 *
 * What these tests deliberately do not cover:
 *   - Picking the file in the media library; ImageUrlFieldControl's own tests.
 *   - The server's check of the same manifest (apps/server graphicDataValidation), and the
 *     graphic drawing the colour (packages/graphics/image).
 */
import imageManifest from '@bajaovrlay/image/image.ograf.json';
import type { Graphic, Item } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '../schemaForm/schemaFormOnTestPage.testSupport';
import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/** The image graphic as the server lists it from its built manifest. */
function buildImageGraphic(): Graphic {
  return {
    id: 'image',
    manifest: structuredClone(imageManifest),
    defaultLayerId: 'image',
    category: 'brand',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** A quick-fire item showing the event's poster bottom-right, pulled onto the safe area. */
function buildEventPosterItem(): Item {
  return {
    id: 'cartaz-do-enduro',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order: 0,
    graphicId: 'image',
    layerId: 'image',
    label: 'Cartaz do Enduro',
    color: 'neutral',
    notes: '',
    fields: {
      imageUrl: { kind: 'literal', value: '/media/4e2a91c7-cartaz-enduro-piracicaba' },
      widthPx: { kind: 'literal', value: 600 },
      position: { kind: 'literal', value: 'bottom-right' },
      offsetXPx: { kind: 'literal', value: -96 },
      offsetYPx: { kind: 'literal', value: -54 },
      opacityPercent: { kind: 'literal', value: 90 },
      entrance: { kind: 'literal', value: 'none' },
      marginPx: { kind: 'literal', value: 12 },
    },
  };
}

/** Opens the editor on the poster item, on a server that lists the image graphic and its layer. */
function renderEditorOnTheEventPoster() {
  const slices = buildSlicesWithTheRaceClockAndTheLowerThird();
  const imageLayer = {
    id: 'image',
    outputId: 'program',
    name: 'Imagem',
    zIndex: 60,
    replacePolicy: 'out-then-in' as const,
    persistent: false,
  };
  return renderItemEditorPanelOnFakeServerWithSlices(buildEventPosterItem(), {
    ...slices,
    graphics: [...slices.graphics, buildImageGraphic()],
    layers: [...slices.layers, imageLayer],
    quickFirePanels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    items: [buildEventPosterItem()],
  });
}

describe('an "Imagem" item in the item editor', () => {
  it('shows the ten fields under their pt-BR labels, with the item’s values', () => {
    // Arrange: nothing beyond the editor itself.

    // Act: open the editor on the poster item.
    renderEditorOnTheEventPoster();

    // Assert: every field with the value the item holds, the empty ones empty.
    expect(
      screen.getByRole('spinbutton', { name: 'Largura (px)' }),
      'the width as stored',
    ).toHaveValue(600);
    expect(
      screen.getByRole('spinbutton', { name: 'Altura (px)' }),
      'no height: the file’s proportions decide it',
    ).toHaveValue(null);
    expect(
      screen.getByRole('combobox', { name: 'Posição' }),
      'the position by its pt-BR name',
    ).toHaveTextContent('Inferior direita');
    expect(
      screen.getByRole('spinbutton', { name: 'Deslocamento X (px)' }),
      'a negative offset is shown as it is',
    ).toHaveValue(-96);
    expect(
      screen.getByRole('spinbutton', { name: 'Deslocamento Y (px)' }),
      'the Y offset as stored',
    ).toHaveValue(-54);
    expect(
      screen.getByRole('spinbutton', { name: 'Opacidade (%)' }),
      'the opacity as stored',
    ).toHaveValue(90);
    expect(
      screen.getByRole('combobox', { name: 'Entrada' }),
      'the entrance by its pt-BR name',
    ).toHaveTextContent('Nenhuma (corte seco)');
    expect(
      screen.getByRole('textbox', { name: 'Fundo' }),
      'no background: the field is empty',
    ).toHaveValue('');
    expect(
      screen.getByRole('spinbutton', { name: 'Margem (px)' }),
      'the margin as stored',
    ).toHaveValue(12);
    expect(
      screen.getByText('Imagem', { selector: 'label' }),
      'the image field is there under its pt-BR label',
    ).toBeInTheDocument();
  });

  it('refuses a background that is not a colour under the field, in pt-BR, and sends nothing', async () => {
    // Arrange: the editor open on the poster item.
    const { fakeServer, onClose } = renderEditorOnTheEventPoster();

    // Act: type a colour's name instead of its code and press "Salvar item".
    typeIntoField('Fundo', 'preto');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: the pattern's message names the field, nothing was sent, the panel stays.
    expect(
      await screen.findByText(
        'Use uma cor no formato #rrggbb em "Fundo", por exemplo #0a0a0a; deixe vazio para não ter cor.',
      ),
      'a text that is not a colour must be explained under the field',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'a refused colour must not be sent').toEqual([]);
    expect(onClose, 'the panel must stay open so the colour can be fixed').not.toHaveBeenCalled();
  });

  it('saves a background typed in capitals as #0a0a0a, in lower case', async () => {
    // Arrange: the editor open on the poster item.
    const { fakeServer } = renderEditorOnTheEventPoster();

    // Act: type a dark plate's colour in capitals, as a design tool copies it, and save.
    typeIntoField('Fundo', '#0A0A0A');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: one change of the item's fields, the colour stored as a literal in lower
    // case, the only case the GDD's pattern takes (the editor sends only what changed).
    expect(
      fakeServer.listCommandsReceived()[0],
      'the background must be saved in lower case',
    ).toMatchObject({
      type: 'updateItemFields',
      fields: { backgroundColor: { kind: 'literal', value: '#0a0a0a' } },
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});
