/**
 * Item editor panel: a graphic field named like one of the editor's own (apps/control)
 *
 * What this module is for:
 *   The item editor has fields of its own ("Gráfico", "Camada", "Rótulo", "Cor",
 *   "Observações", "Onde") and draws the chosen graphic's fields below them. A manifest
 *   may title a field "Rótulo" too. The graphic's fields are grouped in a fieldset named
 *   "Campos do gráfico", so a screen reader says whose field it is, and a test (or an
 *   e2e helper, e2e/itemEditorOwnFields.ts) tells the two apart by looking in or out of it.
 *
 * What these tests prove:
 *   - The graphic's fields sit in the group "Campos do gráfico", and the editor's own
 *     fields of the same name are outside it, one control each.
 *   - Typing in the editor's own "Rótulo" names the item and leaves the graphic's
 *     "Rótulo" field alone.
 *
 * What these tests deliberately do not cover:
 *   - The graphics in this repository, whose manifests may not use the editor's names at
 *     all (packages/graphics/kit's everyManifestPassesTheOGrafSchema.test.ts refuses them).
 *   - The e2e helper on a real page; the e2e walks use it for every editor field.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseGraphicInTheEditor } from './itemEditorOnFakeServer.testSupport';
import { renderItemEditorPanelOnFakeServerWithSlices } from './itemEditorOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/**
 * A pit-board graphic from another author, whose fields are titled "Rótulo" (the board's
 * caption) and "Cor" (the board's colour), the same words as two of the editor's fields.
 */
function buildPitBoardGraphicWithFieldsNamedLikeTheEditors(): Graphic {
  return {
    id: 'pit-board',
    manifest: {
      id: 'outside-pit-board',
      name: 'Placa de box',
      main: 'pit-board.js',
      schema: {
        type: 'object',
        properties: {
          caption: { type: 'string', title: 'Rótulo', default: 'BOX' },
          boardColor: { type: 'string', title: 'Cor', default: 'amarelo' },
        },
      },
    },
    defaultLayerId: 'lower-third',
    category: 'lower-third',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The editor for a new item on a server that also has the pit board, with the board chosen. */
function renderItemEditorWithThePitBoardChosen(): void {
  const slicesAfterBoot = buildSlicesWithTheRaceClockAndTheLowerThird();
  renderItemEditorPanelOnFakeServerWithSlices(null, {
    ...slicesAfterBoot,
    graphics: [...slicesAfterBoot.graphics, buildPitBoardGraphicWithFieldsNamedLikeTheEditors()],
  });
  chooseGraphicInTheEditor('Placa de box');
}

/** The item editor's own controls labelled `label`: those outside "Campos do gráfico". */
function findEditorOwnControlsLabelled(label: string): HTMLElement[] {
  const graphicFields = screen.getByRole('group', { name: 'Campos do gráfico' });
  const everyControlLabelled = screen.getAllByLabelText(label, { exact: true });
  return everyControlLabelled.filter((control) => !graphicFields.contains(control));
}

describe('the item editor panel with a graphic field named like one of its own', () => {
  it('keeps the graphic’s fields in "Campos do gráfico" and its own outside it', () => {
    // Arrange: the editor with the pit board chosen.
    renderItemEditorWithThePitBoardChosen();

    // Act: look for each "Rótulo" control, inside the group and outside it.
    const graphicFields = screen.getByRole('group', { name: 'Campos do gráfico' });
    const graphicCaptionFields = within(graphicFields).getAllByLabelText('Rótulo', {
      exact: true,
    });
    const editorOwnLabelFields = findEditorOwnControlsLabelled('Rótulo');

    // Assert: one of each, and they are two different controls.
    expect(
      graphicCaptionFields,
      'the graphic’s "Rótulo" must be one field in the group',
    ).toHaveLength(1);
    expect(
      editorOwnLabelFields,
      'the editor’s own "Rótulo" must be one field outside it',
    ).toHaveLength(1);
    expect(
      graphicCaptionFields[0],
      'the graphic’s field and the editor’s own must be two controls',
    ).not.toBe(editorOwnLabelFields[0]);
  });

  it('names the item from its own "Rótulo" and leaves the graphic’s alone', () => {
    // Arrange: the editor with the pit board chosen, and both "Rótulo" fields found.
    renderItemEditorWithThePitBoardChosen();
    const graphicFields = screen.getByRole('group', { name: 'Campos do gráfico' });
    const graphicCaptionField = within(graphicFields).getByLabelText('Rótulo', { exact: true });
    const [editorOwnLabelField] = findEditorOwnControlsLabelled('Rótulo');

    // Act: type the item's name in the editor's own field.
    fireEvent.change(editorOwnLabelField as HTMLElement, {
      target: { value: 'Box da equipe 42, Baja UFPR' },
    });

    // Assert: the item's name changed, and the board's caption kept its default.
    expect(editorOwnLabelField, 'the item’s name must be what was typed').toHaveValue(
      'Box da equipe 42, Baja UFPR',
    );
    expect(graphicCaptionField, 'the board’s caption must keep its default').toHaveValue('BOX');
  });
});
