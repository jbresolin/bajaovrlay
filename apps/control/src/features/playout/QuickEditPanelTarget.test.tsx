/**
 * What "Edição rápida" works on, and when it lets go (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" changes ONE instance: the one loaded by "Editar" (on air) or "Editar
 *   prévia" on a "Camadas" row, named in its heading. It never moves to another instance
 *   by itself. Since BAJAOVRLAY-37 it puts nothing new on air, so with nothing loaded it
 *   has no form at all; when the loaded instance goes, the panel says so in one line and
 *   drops the values typed, because there is no other form to keep them in.
 *
 * What these tests prove:
 *   - At page load nothing is loaded, even with a clock on air: no form, no "Atualizar".
 *   - "Editar" on a row loads that instance: the heading names its layer, its graphic (or
 *     the item it came from) and "No ar", and the form shows what that instance holds.
 *   - With the same graphic on air on two layers, "Atualizar" after "Editar" on one of
 *     them is sent to that instance's id and to no other.
 *   - The instance leaving the air, or being replaced, gives one line saying so, the
 *     panel with nothing loaded (its hint and "Novo gráfico…"), no form and no
 *     "Atualizar"; the panel does not start editing the instance that replaced it.
 *   - "Editar prévia" loads the preview, with "Em prévia" in the heading.
 *   - "Parar de editar" lets go of the instance; "Editar" again starts a fresh form.
 * */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
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

const hintOfThePanelWithNothingLoaded = 'Use Editar numa camada para alterar o que está no ar';

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
  it('has nothing loaded, although a clock is on air', () => {
    // Arrange: the endurance clock is on air when the page opens.
    const instancesOnAir = [buildEnduranceClockOnTheClockLayer()];

    // Act: open the page.
    renderQuickEditPanelWithTheseInstancesOnAir(instancesOnAir);

    // Assert: the hint, no form and nothing to update.
    expect(
      screen.getByText(hintOfThePanelWithNothingLoaded),
      'with nothing loaded the panel must say how to load something',
    ).toBeVisible();
    expect(screen.queryByLabelText('Título'), 'with nothing loaded there is no form').toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'with nothing loaded there is no instance to update',
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
  it('says the instance left the air and has nothing loaded, the typed values dropped', () => {
    // Arrange: the clock loaded and its title changed, not yet sent.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceClockOnTheClockLayer(),
    ]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: someone clears the clock layer.
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });

    // Assert: one line, the hint and "Novo gráfico…", and no form any more.
    expect(
      screen.getByText('O que você editava na camada Relógio saiu do ar.'),
      'the panel must say in one line that its instance left the air',
    ).toBeVisible();
    expect(
      screen.getByText(hintOfThePanelWithNothingLoaded),
      'the panel must go back to having nothing loaded',
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Novo gráfico…' }),
      'the way to put a new graphic up must be offered',
    ).toBeVisible();
    expect(
      screen.queryByLabelText('Título'),
      'there is no form left to keep the typed values in',
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'with the instance gone there is nothing to update',
    ).toBeNull();
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

    // Assert: one line, nothing loaded, and no form showing the clock that replaced it.
    expect(
      screen.getByText('O que você editava na camada Relógio foi substituído no ar.'),
      'the panel must say in one line that its instance was replaced',
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { level: 3 }),
      'the panel must not edit the new instance by itself',
    ).toBeNull();
    expect(screen.queryByLabelText('Título'), 'no form may show the new clock').toBeNull();
  });
});

describe('"Editar prévia" on a "Camadas" row', () => {
  it('loads the preview, with "Em prévia" in the heading', () => {
    // Arrange: the start of the endurance race is previewed on the clock layer.
    renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockPreviewOfItem('item-largada-do-enduro', momentTheMainClockWentOnAir),
    ]);

    // Act: press "Editar prévia" on the clock's row.
    pressEditPreviewOnTheLayerRow('Relógio');

    // Assert: the heading says the instance is in preview, and its one button says so too.
    expect(readQuickEditHeader(), 'the heading must say the instance is in preview').toBe(
      'Editando: Relógio · Relógio de prova · Em prévia',
    );
    expect(
      screen.getByRole('button', { name: 'Atualizar prévia' }),
      'a loaded preview is changed in place with "Atualizar prévia"',
    ).toBeInTheDocument();
  });
});

describe('letting go of an instance and loading it again', () => {
  it('"Parar de editar" lets go of the instance', () => {
    // Arrange: the clock loaded and its title changed.
    renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: press "Parar de editar".
    fireEvent.click(screen.getByRole('button', { name: 'Parar de editar' }));

    // Assert: nothing loaded: the hint, and no form.
    expect(
      screen.getByText(hintOfThePanelWithNothingLoaded),
      'the panel must have nothing loaded',
    ).toBeVisible();
    expect(screen.queryByLabelText('Título'), 'the form must be gone').toBeNull();
  });

  it('starts a fresh form when "Editar" is pressed again, the unsent edit gone', () => {
    // Arrange: the clock loaded and its title changed, not yet sent.
    renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);
    pressEditOnTheLayerRow('Relógio');
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: press "Editar" on the same row again.
    pressEditOnTheLayerRow('Relógio');

    // Assert: the form shows what is on air again.
    expect(screen.getByLabelText('Título'), 'a new "Editar" must show what is on air').toHaveValue(
      'Enduro de Resistência',
    );
  });
});
