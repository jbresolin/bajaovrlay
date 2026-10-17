/**
 * "Edição rápida" edits the one instance loaded from "Camadas" (apps/control)
 *
 * What this module is for:
 *   João's walk showed the operator could not tell what "Edição rápida" would change. So
 *   the panel now changes exactly ONE instance, the one loaded by "Editar" on its
 *   "Camadas" row (or "Editar prévia" for the preview on that layer), and its heading
 *   names it: "Editando: Relógio · Relógio de prova · No ar". "Atualizar" goes to that
 *   instance's id only. With nothing loaded the panel makes a new entry ("Nova entrada —
 *   não altera nenhum item"). When the loaded instance leaves its output or is replaced,
 *   one line says so and the panel goes back to a new entry with the same values; it
 *   never moves to another instance by itself.
 *
 * What these tests prove:
 *   - At page load the panel makes a new entry on the first graphic, from the manifest's
 *     defaults, even with a clock on air, and offers no "Atualizar".
 *   - "Editar" on a row loads that instance: the heading names its layer, its graphic (or
 *     the item it came from) and "No ar", and the form shows what that instance holds.
 *   - With the same graphic on air on two layers, "Atualizar" after "Editar" on one of
 *     them is sent to that instance's id and to no other.
 *   - The instance leaving the air, or being replaced, gives one line saying so, a
 *     new-entry heading, no "Atualizar", and the form as it was typed, which "Colocar no
 *     ar" then sends to the same layer. (When that line goes, and why its words never
 *     change: QuickEditPanelLostTargetLine.test.tsx.)
 *   - "Editar prévia" loads the preview: the heading says "Em prévia", "Prévia" replaces
 *     "Atualizar" and re-previews on that layer, and the panel then edits the new preview.
 *   - "Nova entrada" lets go of the instance and keeps the form.
 *   - An accepted "Colocar no ar" from a new entry makes the panel edit what it put on air.
 *
 * What these tests deliberately do not cover:
 *   - The rule that says which of the two the panel is doing: quickEditMode.test.ts.
 *   - Takes from the rundown and the shortcut buttons, which load nothing:
 *     QuickEditPanelNothingLoadedByTakes.test.tsx.
 *   - The layer dropdown of a new entry: QuickEditPanelNewTakeLayer.test.tsx.
 *   - What the fields send, field by field: QuickEditPanel.test.tsx and its neighbours.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  letTheServerPutTheLastTakeOnAir,
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  pressEditPreviewOnTheLayerRow,
  readQuickEditHeader,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// Saturday of the endurance race: the main clock went on air at 10:00, the qualifying
// clock on the "Tarja" layer at 10:05.
const momentTheMainClockWentOnAir = '2026-10-10T13:00:00.000Z';
const momentTheQualifyingClockWentOnAir = '2026-10-10T13:05:00.000Z';
const idOfTheQualifyingClock = '5e8b0d24-7a19-4c3f-96e2-0b1d8f4a7c55';
const idOfTheClockThatReplacedIt = 'a90c2e61-1f4b-4d7e-b3a8-6c5d4e3f2a10';

/** The endurance clock on the "Relógio" layer under green, running from 12:34. */
function buildEnduranceClockOnTheClockLayer(): Instance {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(momentTheMainClockWentOnAir),
      running: true,
    },
    momentTheMainClockWentOnAir,
  );
}

/** A second race clock, for the qualifying, put on the "Tarja" layer by a rundown item. */
function buildQualifyingClockOnTheLowerThirdLayer(): Instance {
  return {
    ...buildRaceClockInstanceHoldingThisData(
      {
        sessionName: 'Classificação',
        state: 'yellow',
        clockMode: 'remaining',
        referenceTimeMs: 600_000,
        referenceWallClockMs: Date.parse(momentTheQualifyingClockWentOnAir),
        running: false,
      },
      momentTheQualifyingClockWentOnAir,
    ),
    id: idOfTheQualifyingClock,
    layerId: 'lower-third',
  };
}

describe('"Edição rápida" when the page opens', () => {
  it('makes a new entry on the first graphic with its defaults, although a clock is on air', () => {
    // Arrange: the endurance clock is on air when the page opens.
    const instancesOnAir = [buildEnduranceClockOnTheClockLayer()];

    // Act: open the page.
    renderQuickEditPanelWithTheseInstancesOnAir(instancesOnAir);

    // Assert: nothing is loaded: a new entry, from the manifest, with no "Atualizar".
    expect(readQuickEditHeader(), 'with nothing loaded the panel must say it is a new entry').toBe(
      'Nova entrada — não altera nenhum item',
    );
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the form must start from the manifest default, not from what is on air',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'a new entry has no instance to update',
    ).toBeNull();
  });
});

describe('"Editar" on a "Camadas" row', () => {
  it('loads that instance: the heading names it, and the form shows what it holds', () => {
    // Arrange: the endurance clock on air.
    renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);

    // Act: press "Editar" on the clock's row.
    pressEditOnTheLayerRow('Relógio');

    // Assert: the heading names the layer, the graphic and the air; the form shows it.
    expect(readQuickEditHeader(), 'the heading must name exactly what will change').toBe(
      'Editando: Relógio · Relógio de prova · No ar',
    );
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the form must show the flag that instance has on air',
    ).toHaveTextContent('Verde');
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      'an instance on air can be changed in place',
    ).toBeInTheDocument();
  });

  it('names the item an instance was taken from, by its label', () => {
    // Arrange: the endurance clock was put on air by the item "Largada do enduro".
    const clockFromTheStartItem: Instance = {
      ...buildEnduranceClockOnTheClockLayer(),
      itemId: 'item-largada-do-enduro',
    };
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([clockFromTheStartItem]);
    fakeServer.sendMessage({
      type: 'slice',
      name: 'items',
      slice: [
        {
          id: 'item-largada-do-enduro',
          home: { kind: 'rundown', rundownId: 'sessao-principal' },
          order: 0,
          graphicId: 'race-clock',
          layerId: 'clock',
          fields: {},
          label: 'Largada do enduro',
          color: 'success',
          notes: '',
        },
      ],
    });

    // Act: press "Editar" on the clock's row.
    pressEditOnTheLayerRow('Relógio');

    // Assert: the item's label is how the operator knows that instance.
    expect(readQuickEditHeader(), 'the heading must use the label of the item').toBe(
      'Editando: Relógio · Largada do enduro · No ar',
    );
  });

  it('sends "Atualizar" to that instance only, when the same graphic is on air twice', async () => {
    // Arrange: two race clocks on air, and "Editar" pressed on the qualifying one.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceClockOnTheClockLayer(),
      buildQualifyingClockOnTheLowerThirdLayer(),
    ]);
    pressEditOnTheLayerRow('Tarja');
    typeIntoField('Título', 'Classificação — Bateria 2');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: one update, to the qualifying clock's id, carrying only the new title.
    expect(
      fakeServer.listCommandsReceived(),
      'only the loaded instance may change; the other clock must be left alone',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheQualifyingClock,
        data: { sessionName: 'Classificação — Bateria 2' },
        takeTimeFieldKeys: [],
      },
    ]);
  });
});

describe('"Edição rápida" when the loaded instance is gone', () => {
  it('says the instance left the air, keeps the typed values, and "Colocar no ar" uses the same layer', async () => {
    // Arrange: the clock loaded and its title changed, not yet sent.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceClockOnTheClockLayer(),
    ]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: someone clears the clock layer; then the operator presses "Colocar no ar".
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
    const headerAfterTheClear = readQuickEditHeader();
    const isUpdateStillOffered = screen.queryByRole('button', { name: 'Atualizar' }) !== null;
    const isTheLineShownAfterTheClear =
      screen.queryByText(
        'O que você editava na camada Relógio saiu do ar. Os valores continuam no formulário, como nova entrada.',
      ) !== null;
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: one line, a new entry, the values kept, and the take on the clock layer.
    // (Sending the new entry then takes the line away: QuickEditPanelLostTargetLine.test.tsx.)
    expect(
      isTheLineShownAfterTheClear,
      'the panel must say in one line that its instance left the air',
    ).toBe(true);
    expect(headerAfterTheClear, 'the panel must go back to a new entry').toBe(
      'Nova entrada — não altera nenhum item',
    );
    expect(isUpdateStillOffered, 'with the instance gone there is nothing to update').toBe(false);
    expect(
      fakeServer.listCommandsReceived(),
      'the new entry must carry what was typed, on the layer the instance was on',
    ).toEqual([
      expect.objectContaining({
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: expect.objectContaining({ sessionName: 'Enduro — Bateria 2', state: 'green' }),
      }),
    ]);
  });

  it('says the instance was replaced, and does not start editing the one that replaced it', () => {
    // Arrange: the clock loaded and its title changed, not yet sent.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceClockOnTheClockLayer(),
    ]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: a take from the rundown puts another clock, under red, on the same layer.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [
        {
          ...buildEnduranceClockOnTheClockLayer(),
          id: idOfTheClockThatReplacedIt,
          resolvedData: { ...buildEnduranceClockOnTheClockLayer().resolvedData, state: 'red' },
        },
      ],
    });

    // Assert: one line, a new entry, and the form still as the operator left it.
    expect(
      screen.getByText(
        'O que você editava na camada Relógio foi substituído no ar. Os valores continuam no formulário, como nova entrada.',
      ),
      'the panel must say in one line that its instance was replaced',
    ).toBeInTheDocument();
    expect(readQuickEditHeader(), 'the panel must not edit the new instance by itself').toBe(
      'Nova entrada — não altera nenhum item',
    );
    expect(screen.getByLabelText('Título'), 'the typed title must stay in the form').toHaveValue(
      'Enduro — Bateria 2',
    );
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the form must not take the flag of the clock that replaced it',
    ).toHaveTextContent('Verde');
  });
});

describe('"Editar prévia" on a "Camadas" row', () => {
  it('loads the preview: "Em prévia", and "Prévia" in place of "Atualizar" re-previews that layer', async () => {
    // Arrange: the start of the endurance race is previewed on the clock layer.
    const previewOfTheStart = buildRaceClockPreviewOfItem(
      'item-largada-do-enduro',
      momentTheMainClockWentOnAir,
    );
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([previewOfTheStart]);
    pressEditPreviewOnTheLayerRow('Relógio');
    const headerOfThePreview = readQuickEditHeader();
    const isUpdateOffered = screen.queryByRole('button', { name: 'Atualizar' }) !== null;
    typeIntoField('Título', 'Enduro — Largada');

    // Act: press "Prévia"; the server replaces the preview by a new one and answers ok.
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [{ ...previewOfTheStart, id: idOfTheClockThatReplacedIt, itemId: undefined }],
    });
    fakeServer.acceptLastCommand();

    // Assert: a preview heading, no "Atualizar", the preview on the same layer, and the
    // panel still editing the preview it has just made.
    expect(headerOfThePreview, 'the heading must say the instance is in preview').toBe(
      'Editando: Relógio · Relógio de prova · Em prévia',
    );
    expect(isUpdateOffered, 'a preview is changed by previewing it again').toBe(false);
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia" must preview the form on the layer of the loaded preview',
    ).toEqual([
      expect.objectContaining({
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: expect.objectContaining({ sessionName: 'Enduro — Largada' }),
      }),
    ]);
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Editando: Relógio · Relógio de prova · Em prévia',
      }),
      'its own preview replaced the old one, so the panel edits the new preview',
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/foi substituída/),
      'a preview the panel made itself is not reported as a replacement',
    ).toBeNull();
  });
});

describe('leaving and making instances from "Edição rápida"', () => {
  it('"Nova entrada" lets go of the instance and keeps the form', () => {
    // Arrange: the clock loaded and its title changed.
    renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: press "Nova entrada".
    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));

    // Assert: a new entry with the typed title, and no "Atualizar".
    expect(
      screen.getByRole('heading', { level: 3 }),
      'the panel must go back to a new entry',
    ).toHaveTextContent('Nova entrada — não altera nenhum item');
    expect(screen.getByLabelText('Título'), 'the form must keep what was typed').toHaveValue(
      'Enduro — Bateria 2',
    );
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'a new entry has no instance to update',
    ).toBeNull();
  });

  it('edits the instance its own accepted "Colocar no ar" put on air', async () => {
    // Arrange: nothing on air; the new entry is the race clock on its default layer.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Act: press "Colocar no ar"; the server puts the clock on air and answers ok.
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(
      fakeServer,
      idOfTheClockThatReplacedIt,
      momentTheMainClockWentOnAir,
    );

    // Assert: the panel now edits that very clock, named in the heading.
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Editando: Relógio · Relógio de prova · No ar',
      }),
      'after its own take the panel must edit what it put on air',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      'the clock just taken can be changed in place',
    ).toBeInTheDocument();
  });
});
