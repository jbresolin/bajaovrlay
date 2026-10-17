/**
 * "Edição rápida" with a preview loaded: "Atualizar prévia" (apps/control)
 *
 * What this module is for:
 *   "Editar prévia" on a Camadas row loads what that layer holds on the preview output.
 *   Since BAJAOVRLAY-37 the panel changes that preview in place, as it changes an
 *   instance on air: "Atualizar prévia" sends `updateInstanceData` to the preview
 *   instance's own id, with only the fields the operator changed. The preview keeps its id
 *   and its item, so "Tomar" sends to air exactly what was seen. Nothing in the panel
 *   makes a new preview any more.
 *
 * What these tests prove:
 *   - With a preview loaded the panel offers "Atualizar prévia" and no other send: no
 *     "Prévia", no "Colocar no ar", no "Atualizar".
 *   - "Atualizar prévia" sends one `updateInstanceData` naming the preview's id, with only
 *     the field changed.
 *   - Once the server applied it, the form shows the preview as it is now and counts as
 *     untouched: a second press sends nothing.
 *   - A refused "Atualizar prévia" is explained next to the button, in the server's words.
 *   - With a loaded preview whose data lacks fields, the line naming them speaks of
 *     "Atualizar prévia".
 *
 * What these tests deliberately do not cover:
 *   - "Tomar", which sends the preview to air: features/outputMonitors' tests, and the
 *     server's updatePreviewInstanceData.test.ts for what it promotes.
 *   - "Atualizar" of an instance on air: QuickEditPanel.test.tsx and its siblings.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  buildRaceClockPreviewOfItem,
  idOfTheRaceClockPreview,
} from '@/state/previewLikeTheServerSends.testSupport';

import {
  letTheServerApplyTheLastUpdate,
  pressButtonAndWaitForCommand,
  pressButtonAndWaitUntilThePressIsOver,
  pressEditPreviewOnTheLayerRow,
  referenceMomentLabel,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';

// The operator previewed the start of the endurance race at 9:58 in Brasília, and
// changes the preview at 10:00.
const momentTheStartWasPreviewed = '2026-10-10T12:58:00.000Z';
const momentOfTheUpdate = '2026-10-10T13:00:00.000Z';

/** "Largada do enduro" on the preview output of the clock layer, as previewItem left it. */
function buildEnduranceStartInPreview(): Instance {
  return buildRaceClockPreviewOfItem('item-largada-do-enduro', momentTheStartWasPreviewed);
}

/** The "Edição rápida" panel's own area, so the Camadas buttons are not counted. */
function findQuickEditArea() {
  return within(screen.getByRole('region', { name: 'Edição rápida' }));
}

describe('"Edição rápida" with a preview loaded', () => {
  it('offers "Atualizar prévia" and no other way to send', () => {
    // Arrange: the start of the race in preview on the clock layer.
    renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceStartInPreview()]);

    // Act: load the preview with "Editar prévia".
    pressEditPreviewOnTheLayerRow('Relógio');

    // Assert: the one send is "Atualizar prévia"; nothing makes a new preview or a take.
    const buttonNames = findQuickEditArea()
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(buttonNames, 'a loaded preview must be changed in place only').toContain(
      'Atualizar prévia',
    );
    for (const sendThatIsGone of ['Prévia', 'Colocar no ar', 'Atualizar', 'Salvar como item']) {
      expect(buttonNames, `"${sendThatIsGone}" must not be offered for a preview`).not.toContain(
        sendThatIsGone,
      );
    }
  });

  it('sends updateInstanceData to the preview itself, with only the field changed', async () => {
    // Arrange: the preview loaded, and the flag changed to yellow.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceStartInPreview(),
    ]);
    pressEditPreviewOnTheLayerRow('Relógio');
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar prévia".
    await pressButtonAndWaitForCommand('Atualizar prévia', 1, fakeServer);

    // Assert: one update, naming the preview's id, holding the flag alone.
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar prévia" must change the preview in place, by its id',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockPreview,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('counts as untouched once the server applied it, so a second press sends nothing', async () => {
    // Arrange: the flag of the preview changed to yellow, sent, and applied by the server.
    const previewBeforeTheUpdate = buildEnduranceStartInPreview();
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([previewBeforeTheUpdate]);
    pressEditPreviewOnTheLayerRow('Relógio');
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar prévia', 1, fakeServer);
    letTheServerApplyTheLastUpdate(fakeServer, previewBeforeTheUpdate, momentOfTheUpdate);
    await waitUntilButtonIsOnAgain('Atualizar prévia');

    // Act: press "Atualizar prévia" again without touching anything.
    await pressButtonAndWaitUntilThePressIsOver('Atualizar prévia');

    // Assert: still one command; the form shows yellow and the panel still edits the preview.
    expect(
      fakeServer.listCommandsReceived(),
      'an untouched form must send nothing',
    ).toHaveLength(1);
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the form must show the preview as the server now holds it',
    ).toHaveTextContent('Amarela');
    expect(
      screen.getByRole('heading', { level: 3 }).textContent,
      'the panel must still be editing the same preview',
    ).toContain('Em prévia');
  });

  it('explains a refused "Atualizar prévia" next to the button, in the server\'s words', async () => {
    // Arrange: the preview loaded, the flag changed, and the update sent.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceStartInPreview(),
    ]);
    pressEditPreviewOnTheLayerRow('Relógio');
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar prévia', 1, fakeServer);

    // Act: another operator discarded the preview first, and the server refuses.
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'O gráfico que você tentou atualizar não está mais no ar.',
    });

    // Assert: the refusal is shown in the panel.
    await waitFor(() => {
      expect(
        findQuickEditArea().getByText('O gráfico que você tentou atualizar não está mais no ar.'),
        'the server’s refusal must be shown where the operator pressed',
      ).toBeVisible();
    });
  });
});

describe('"Edição rápida" with a loaded preview whose fields could not all be read', () => {
  it('names those fields and says what "Atualizar prévia" sends', () => {
    // Arrange: a race clock previewed on the clock layer whose data has no clock fields
    // at all (made by an older version of the graphic, say).
    const previewWithoutClockFields: Instance = {
      ...buildEnduranceStartInPreview(),
      resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
    };
    renderQuickEditPanelWithTheseInstancesOnAir([previewWithoutClockFields]);

    // Act: load the preview with "Editar prévia".
    pressEditPreviewOnTheLayerRow('Relógio');

    // Assert: the line names the four fields and speaks of the one button a preview has.
    expect(
      screen.getByText(/não puderam ser lidos/).textContent,
      'the line for a loaded preview must say what its own button does',
    ).toBe(
      `Estes campos da prévia não puderam ser lidos e aparecem com o valor inicial: Modo do relógio, ${referenceTimeLabel}, ${referenceMomentLabel}, Relógio correndo. "Atualizar prévia" envia só o que você alterar; preencha estes campos para enviá-los.`,
    );
  });
});
