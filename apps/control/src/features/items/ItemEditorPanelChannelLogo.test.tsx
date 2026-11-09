/**
 * Item editor panel: the seeded "Logo do canal" with no image chosen (apps/control)
 *
 * What this module is for:
 *   The server seeds a "Logo do canal" item once per database (BAJAOVRLAY-63) on the logo
 *   bug, with its corner, height and opacity at the defaults and no image, so the operator
 *   only picks the file. Until a file is picked the item must never reach the air empty:
 *   the logo bug's manifest marks the image as required, and the editor's generated form
 *   refuses it in pt-BR.
 *
 * What these tests prove (with the real logo-bug manifest):
 *   - Saving the seeded item with no image is refused with "O campo "Imagem" é
 *     obrigatório.", nothing is sent and the panel stays open.
 *   - The editor shows the seeded corner, height and opacity as they were seeded.
 *
 * What these tests deliberately do not cover:
 *   - Picking the file in the media library; ImageUrlFieldControl's own tests.
 *   - The server refusing a take of the item from its button, which checks the same
 *     manifest (apps/server graphicDataValidation).
 */
import logoBugManifest from '@bajaovrlay/logo-bug/logo-bug.ograf.json';
import type { Graphic, Item } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderItemEditorPanelOnFakeServerWithSlices } from './itemEditorOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/** The logo bug as the server lists it from its built manifest. */
function buildLogoBugGraphic(): Graphic {
  return {
    id: 'logo-bug',
    manifest: structuredClone(logoBugManifest),
    defaultLayerId: 'channel-logo',
    category: 'brand',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The "Logo do canal" item as the server seeds it, alone in its "Logo" panel, with no image. */
function buildSeededChannelLogoItem(): Item {
  return {
    id: 'logo-do-canal',
    home: { kind: 'quickFire', panelId: 'logo' },
    order: 0,
    graphicId: 'logo-bug',
    layerId: 'channel-logo',
    label: 'Logo do canal',
    color: 'neutral',
    notes: '',
    fields: {
      corner: { kind: 'literal', value: 'bottom-right' },
      heightPx: { kind: 'literal', value: 80 },
      opacityPercent: { kind: 'literal', value: 100 },
    },
  };
}

/** Opens the editor on the seeded item, on a server that lists the logo bug and its layer. */
function renderEditorOnTheSeededChannelLogo() {
  const slices = buildSlicesWithTheRaceClockAndTheLowerThird();
  const channelLogoLayer = {
    id: 'channel-logo',
    outputId: 'program',
    name: 'Logo do canal',
    zIndex: 15,
    replacePolicy: 'out-then-in' as const,
    persistent: true,
  };
  return renderItemEditorPanelOnFakeServerWithSlices(buildSeededChannelLogoItem(), {
    ...slices,
    graphics: [...slices.graphics, buildLogoBugGraphic()],
    layers: [...slices.layers, channelLogoLayer].sort(
      (lower, higher) => lower.zIndex - higher.zIndex,
    ),
    quickFirePanels: [
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'logo', name: 'Logo', order: 2 },
    ],
    items: [buildSeededChannelLogoItem()],
  });
}

describe('the seeded "Logo do canal" in the item editor', () => {
  it('refuses to save it with no image, naming the field in pt-BR', async () => {
    // Arrange: the editor open on the seeded item, its image never picked.
    const { fakeServer, onClose } = renderEditorOnTheSeededChannelLogo();

    // Act: press "Salvar item" straight away.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }));

    // Assert: the image is named as required, nothing was sent, the panel stays open.
    expect(
      await screen.findByText('O campo "Imagem" é obrigatório.'),
      'the missing image must be reported in pt-BR, naming the field',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'an item with no image must not be sent').toEqual([]);
    expect(onClose, 'the panel must stay open so the file can be picked').not.toHaveBeenCalled();
  });

  it('shows the seeded corner, height and opacity', () => {
    // Arrange: nothing beyond the editor itself.

    // Act: open the editor on the seeded item.
    renderEditorOnTheSeededChannelLogo();

    // Assert: the three values as seeded, under their pt-BR labels.
    expect(
      screen.getByRole('combobox', { name: 'Canto' }),
      'the corner as seeded',
    ).toHaveTextContent('Inferior direito');
    expect(
      screen.getByRole('spinbutton', { name: 'Altura (px)' }),
      'the height as seeded',
    ).toHaveValue(80);
    expect(
      screen.getByRole('spinbutton', { name: 'Opacidade (%)' }),
      'the opacity as seeded',
    ).toHaveValue(100);
  });
});
