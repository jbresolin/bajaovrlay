/**
 * Item editor panel: a new item opened already filled ("Salvar como item") (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" can turn what it shows into an item: "Salvar como item" opens the
 *   page's item editor for a new item through ItemEditorTargetProvider, handing it a
 *   prefill (the graphic, the layer and the field values, each in its kind). The editor
 *   opens on that graphic and layer with those values; the operator only adds a label,
 *   checks "Onde" and saves.
 *
 * What these tests prove:
 *   - Opened with a prefill, the editor shows that graphic and layer and fills the
 *     graphic's fields from it, and "Salvar item" sends a `createItem` carrying that
 *     graphic, that layer, the label typed and the fields in their kinds (a typed Título
 *     stays literal, a reference moment left to the take stays takeTime), to the home
 *     the editor was opened for.
 *   - Opening with a prefill again starts a fresh form: what was typed before is gone.
 *
 * What these tests deliberately do not cover:
 *   - The "Salvar como item" button and how it builds the prefill: features/playout.
 *   - A new item without a prefill: ItemEditorPanel.test.tsx.
 */
import type { ItemHome } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RundownPanel } from '@/features/rundown/RundownPanel';
import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { pressSaveAndWaitForCommand } from './itemEditorOnFakeServer.testSupport';
import { type ItemEditorPrefill, useItemEditorTarget } from './ItemEditorTargetProvider';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/** The text of the stand-in for "Salvar como item" of "Edição rápida". */
const saveAsItemStandInText = 'Salvar como item (substituto de teste)';

/** The quick-fire panel the server seeds, where the new item is asked to go. */
const shortcutsPanelHome: ItemHome = { kind: 'quickFire', panelId: 'atalhos' };

/**
 * What "Edição rápida" holds when the operator saves it as an item: the race clock on the
 * lower-third layer, titled "Classificação", counting up from zero, with its reference
 * moment left to the take.
 */
function buildPrefillOfTheQualifyingClockOnTheLowerThird(): ItemEditorPrefill {
  return {
    graphicId: 'race-clock',
    layerId: 'lower-third',
    fields: {
      sessionName: { kind: 'literal', value: 'Classificação' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: true },
    },
  };
}

/** Stands in for "Salvar como item": opens the page's editor with the prefill above. */
function SaveAsItemStandIn() {
  const { openItemEditorForNewItem } = useItemEditorTarget();
  return (
    <button
      type="button"
      onClick={() =>
        openItemEditorForNewItem(
          shortcutsPanelHome,
          buildPrefillOfTheQualifyingClockOnTheLowerThird(),
        )
      }
    >
      {saveAsItemStandInText}
    </button>
  );
}

/** The rundown column (which draws the page's one item editor) beside the stand-in. */
function renderRundownColumnWithTheSaveAsItemStandIn() {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <SaveAsItemStandIn />
      <RundownPanel />
    </>,
    buildSlicesWithTheRaceClockAndTheLowerThird(),
  );
}

describe('the item editor opened with a prefill', () => {
  it('opens on the prefilled graphic, layer and fields, and saves them with their kinds', async () => {
    // Arrange: the page, with the editor opened through "Salvar como item".
    const { fakeServer } = renderRundownColumnWithTheSaveAsItemStandIn();
    fireEvent.click(screen.getByRole('button', { name: saveAsItemStandInText }));
    const layerShownAtTheOpening = screen.getByRole('combobox', { name: 'Camada' }).textContent;

    // Act: type a label and press "Salvar item".
    typeIntoField('Rótulo', 'Relógio da classificação');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the editor opened on the prefilled layer, and the createItem carries the
    // prefilled graphic, layer and fields in their kinds, to the home it was opened for.
    expect(layerShownAtTheOpening, 'the editor must open on the prefilled layer').toBe('Tarja');
    expect(
      fakeServer.listCommandsReceived(),
      'the new item must keep the graphic, the layer and each field in its kind',
    ).toEqual([
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        graphicId: 'race-clock',
        layerId: 'lower-third',
        label: 'Relógio da classificação',
        color: 'neutral',
        notes: '',
        fields: {
          sessionName: { kind: 'literal', value: 'Classificação' },
          state: { kind: 'literal', value: 'green' },
          clockMode: { kind: 'literal', value: 'elapsed' },
          referenceTimeMs: { kind: 'literal', value: 0 },
          referenceWallClockMs: { kind: 'takeTime' },
          running: { kind: 'literal', value: true },
        },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('starts a fresh form when it is opened with a prefill again', () => {
    // Arrange: the editor opened through "Salvar como item", with a label typed.
    renderRundownColumnWithTheSaveAsItemStandIn();
    fireEvent.click(screen.getByRole('button', { name: saveAsItemStandInText }));
    typeIntoField('Rótulo', 'Relógio da classificação');

    // Act: "Salvar como item" is pressed again, without closing the editor.
    fireEvent.click(screen.getByRole('button', { name: saveAsItemStandInText }));

    // Assert: the label typed for the first opening is gone; the prefill is back.
    expect(
      screen.getByLabelText('Rótulo'),
      'a second opening with a prefill must not keep what was typed for the first',
    ).toHaveValue('');
    expect(
      screen.getByLabelText('Título'),
      'the second opening must be filled from the prefill again',
    ).toHaveValue('Classificação');
  });
});
