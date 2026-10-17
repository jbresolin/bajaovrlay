/**
 * "Edição rápida": the "Prévia" button (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" puts any graphic on air from a form. Its "Prévia" button shows the
 *   same form on the preview output first (`previewGraphic`), so the operator sees the
 *   graphic with the values just typed before anybody else does. The command is built
 *   exactly as "Colocar no ar" builds its own: the graphic's default layer, the whole
 *   form as it stands, a cleared field left out, and a field the server fills with the
 *   moment of the command named in `takeTimeFieldKeys`.
 *
 * What these tests prove:
 *   - "Prévia" sends one `previewGraphic` for the graphic's default layer with what was
 *     typed and chosen; a blank optional field is left out, and the reference moment is
 *     asked of the server, not sent.
 *   - Except for its `type`, the command is the very one "Colocar no ar" sends for the
 *     same form.
 *   - With the graphic on air, "Prévia" still sends the whole form (not only the changed
 *     fields, as "Atualizar" does), and after the server accepts it the operator's edit
 *     is still an unsent edit: "Atualizar" then sends the changed field.
 *   - A field that fails its rule blocks the preview with the message under the field.
 *   - A refused preview is explained next to the buttons, in the server's words.
 *   - While the connection is down the button is disabled.
 *   - With a loaded preview whose data lacks fields, the line naming them is the preview
 *     variant: it speaks of "Prévia" and "Colocar no ar", never of "Atualizar".
 *
 * What these tests deliberately do not cover:
 *   - The preview appearing on the page: the lines under the "Prévia" monitor
 *     (features/outputMonitors/PreviewedLayersList.test.tsx) and the monitor itself.
 *   - "Tomar", which sends that preview to air: the same test file.
 *   - What the server does with `previewGraphic` (it remembers the stamped fields so a
 *     take stamps them again); apps/server's previewGraphic.test.ts and takePreview.test.ts.
 *   - "Colocar no ar" and "Atualizar" themselves: QuickEditPanel.test.tsx.
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  holdThePageClockAt,
  idOfTheRaceClockInstanceOnAir,
  lapsLabel,
  pressButtonAndWaitForCommand,
  pressButtonAndWaitUntilThePressIsOver,
  pressEditOnTheLayerRow,
  pressEditPreviewOnTheLayerRow,
  referenceMomentLabel,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator is at the page at 10:00.
const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
const momentTheOperatorIsAtThePage = '2026-10-10T13:00:00.000Z';

/** The first heat on air since 9:45 under the green flag, stopped at 12:34. */
function buildFirstHeatOnAirStoppedAtTwelveThirtyFour() {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(momentTheClockWentOnAir),
      running: false,
    },
    momentTheClockWentOnAir,
  );
}

describe('the "Prévia" button of "Edição rápida" with nothing on air', () => {
  it('sends previewGraphic with what was typed and chosen, for the default layer of the graphic', async () => {
    // Arrange: the panel filled for the endurance race, 12 min 34 s in, under green.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Título', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    flipSwitch('Relógio correndo');
    typeIntoField(referenceTimeLabel, '12:34');

    // Act: press "Prévia".
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);

    // Assert: one previewGraphic for the clock layer (the race clock's default layer).
    // The laps, left blank, are not in the data; the reference moment is not in it
    // either: the server is asked to write the moment of the command there.
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia" must send exactly one previewGraphic with the form as it stands',
    ).toEqual([
      {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: {
          sessionName: 'Enduro de Resistência — Bateria 1',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 754_000,
          running: true,
        },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('sends the very command "Colocar no ar" sends for the same form, under another type', async () => {
    // Arrange: the panel with a session name, a time and the leader's laps typed.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Título', 'Enduro de Resistência — Bateria 2');
    typeIntoField(referenceTimeLabel, '45:00');
    typeIntoField(lapsLabel, '31');

    // Act: press "Prévia", let the server accept it, then press "Colocar no ar".
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitUntilButtonIsOnAgain('Colocar no ar');
    await pressButtonAndWaitForCommand('Colocar no ar', 2, fakeServer);

    // Assert: apart from the type, the two commands are the same, field by field.
    const [previewCommand, takeCommand] = fakeServer.listCommandsReceived();
    expect(
      { ...(previewCommand as object), type: 'takeGraphic' },
      'what is previewed must be exactly what "Colocar no ar" would put on air',
    ).toEqual(takeCommand);
    fakeServer.acceptLastCommand();
  });

  it('sends nothing and shows the message under the field when a required field is empty', async () => {
    // Arrange: the panel with the session name, a required field, erased.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Título', '');

    // Act: press "Prévia" and wait until the press is over.
    await pressButtonAndWaitUntilThePressIsOver('Prévia');

    // Assert: the form's own message is on screen and no command left the page.
    expect(
      await screen.findByText('O campo "Título" é obrigatório.'),
      'a form that fails its rules must say which field is wrong',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a form that fails its rules must not be previewed',
    ).toEqual([]);
  });

  it("shows the server's pt-BR message next to the buttons when the preview is refused", async () => {
    // Arrange: "Prévia" was pressed with the form as it opens.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);

    // Act: the server refuses: the layer was removed from its configuration.
    fakeServer.refuseLastCommand({
      code: 'LAYER_NOT_FOUND',
      message: 'A camada "clock" não existe.',
    });

    // Assert: the reason is on screen, and the button can be pressed again.
    expect(
      await screen.findByRole('alert'),
      'a refused preview must be explained next to the buttons, in the words of the server',
    ).toHaveTextContent('A camada "clock" não existe.');
    await waitUntilButtonIsOnAgain('Prévia');
  });

  it('is disabled while the connection is down', () => {
    // Arrange: the panel on a connected page.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: nothing can be previewed without a connection.
    expect(
      screen.getByRole('button', { name: 'Prévia' }),
      '"Prévia" cannot be pressed while the page cannot reach the server',
    ).toBeDisabled();
  });
});

describe('the "Prévia" button of "Edição rápida" with the graphic on air', () => {
  it('previews the whole form, and leaves the edit unsent so "Atualizar" still sends it', async () => {
    // Arrange: the first heat is on air, stopped at 12:34, loaded with "Editar", and the
    // operator changes only the flag to yellow.
    holdThePageClockAt(momentTheOperatorIsAtThePage);
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildFirstHeatOnAirStoppedAtTwelveThirtyFour(),
    ]);
    pressEditOnTheLayerRow('Relógio');
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Prévia", let the server accept it, then press "Atualizar".
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitUntilButtonIsOnAgain('Atualizar');
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the preview carried every field of the form (the graphic has to be drawn
    // whole), the reference moment as the number that is on air; and the update that
    // followed still carried the flag, because a preview changes nothing on air and so
    // must not make the form forget the edit.
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'the preview must carry the whole form and the update only the changed flag',
      ).toEqual([
        {
          type: 'previewGraphic',
          graphicId: 'race-clock',
          layerId: 'clock',
          data: {
            sessionName: 'Enduro de Resistência — Bateria 1',
            state: 'yellow',
            clockMode: 'elapsed',
            referenceTimeMs: 754_000,
            referenceWallClockMs: Date.parse(momentTheClockWentOnAir),
            running: false,
          },
          takeTimeFieldKeys: [],
        },
        {
          type: 'updateInstanceData',
          instanceId: idOfTheRaceClockInstanceOnAir,
          data: { state: 'yellow' },
          takeTimeFieldKeys: [],
        },
      ]);
    });
    fakeServer.acceptLastCommand();
  });
});

describe('"Edição rápida" with a loaded preview whose fields could not all be read', () => {
  it('names those fields and says what "Prévia" and "Colocar no ar" do, with no word of "Atualizar"', () => {
    // Arrange: a race clock previewed on the clock layer whose data has no clock fields
    // at all (made by an older version of the graphic, say).
    const previewWithoutClockFields = {
      ...buildRaceClockInstanceHoldingThisData(
        { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
        momentTheClockWentOnAir,
      ),
      target: 'preview' as const,
      status: 'loading' as const,
    };
    renderQuickEditPanelWithTheseInstancesOnAir([previewWithoutClockFields]);

    // Act: load the preview with "Editar prévia".
    pressEditPreviewOnTheLayerRow('Relógio');

    // Assert: the line names the four fields and speaks of the two buttons a loaded
    // preview has; "Atualizar" is not offered, so the line must not mention it.
    expect(
      screen.getByText(/não puderam ser lidos/).textContent,
      'the line for a loaded preview must say what its own buttons do',
    ).toBe(
      `Estes campos da prévia não puderam ser lidos e aparecem com o valor inicial: Modo do relógio, ${referenceTimeLabel}, ${referenceMomentLabel}, Relógio correndo. "Prévia" envia o formulário inteiro e substitui a prévia; "Colocar no ar" envia o formulário inteiro ao ar.`,
    );
  });
});
