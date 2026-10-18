/**
 * Camadas: an instance with no item, "sem item" and "Salvar como item" (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 every instance the server makes comes from an item. One put on
 *   air by hand before that may still be on air after the upgrade, with no item behind
 *   it. Camadas names it "sem item", it can still be edited and cleared, and its row
 *   offers "Salvar como item", the one place that action remains: it opens the item
 *   editor filled with what is on air, so the operator gives it a label and keeps it.
 *   For a clock, the wall-clock moment needs the same choice as "Salvar no item".
 *
 * What these tests prove:
 *   - The row says "sem item" and offers "Editar", "Limpar" and "Salvar como item".
 *   - "Salvar como item" for the lower third opens the editor for a new item of that
 *     graphic and layer, filled with what is on air, without asking anything.
 *   - For a clock it asks first: "Continuar este relógio" fills the moment as a typed
 *     number, "Começar na entrada no ar" as the moment of each take.
 *
 * What these tests deliberately do not cover:
 *   - What the editor then saves: features/items' tests.
 *   - The server keeping such an instance on air: apps/server's
 *     storeLegacyInstanceWithoutItem.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildSlicesWithTheRaceClockAndTheLowerThird } from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureInstanceOnProgram } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const momentOfTheTakeByHand = '2026-10-10T13:00:00.000Z';

/** The interview lower third "Edição rápida" put on air by hand before BAJAOVRLAY-37. */
function buildLowerThirdTakenByHand(): Instance {
  return buildLowerThirdFixtureInstanceOnProgram({
    id: 'e7c3a9f1-5d2b-4c86-a0e4-9b1f6d3c8a52',
    layerId: 'lower-third',
    resolvedData: { nome: 'Marina Tavares', cargo: 'Capitã', equipe: 'baja-ufpr' },
    takenAt: momentOfTheTakeByHand,
  });
}

/** Draws Camadas beside the rundown column (which draws the item editor), with these instances. */
function renderCamadasBesideTheRundownWith(instances: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(
    <div>
      <RundownPanel />
      <LayerStatusPanel />
    </div>,
    { ...buildSlicesWithTheRaceClockAndTheLowerThird(), instances },
  );
}

/** The Camadas row of one layer. */
function findLayerRow(layerName: string) {
  return within(screen.getByRole('listitem', { name: layerName }));
}

/** The item editor's own area. */
function findItemEditorArea() {
  return within(screen.getByRole('region', { name: 'Editor de item' }));
}

describe('an instance put on air by hand before items were required', () => {
  it('is named "sem item" and can be edited, cleared and saved as an item', () => {
    // Arrange and act: Camadas with the lower third taken by hand on air.
    renderCamadasBesideTheRundownWith([buildLowerThirdTakenByHand()]);

    // Assert: the row says it has no item and offers the three actions.
    const lowerThirdRow = findLayerRow('Tarja');
    expect(lowerThirdRow.getByText('sem item'), 'the row must say there is no item').toBeVisible();
    for (const actionName of ['Editar', 'Limpar', 'Salvar como item']) {
      expect(
        lowerThirdRow.getByRole('button', { name: actionName }),
        `"${actionName}" must be offered for an instance without an item`,
      ).toBeVisible();
    }
  });

  it('opens the item editor filled with what is on air, for the lower third', () => {
    // Arrange: Camadas with the lower third taken by hand on air.
    renderCamadasBesideTheRundownWith([buildLowerThirdTakenByHand()]);

    // Act: "Salvar como item" on its row.
    fireEvent.click(findLayerRow('Tarja').getByRole('button', { name: 'Salvar como item' }));

    // Assert: no question; a new item of the lower third, filled from the air.
    expect(screen.queryByRole('dialog'), 'a lower third has no clock to ask about').toBeNull();
    const editorArea = findItemEditorArea();
    expect(
      editorArea.getByRole('heading', { name: 'Novo item' }),
      'the editor must be open for a new item',
    ).toBeVisible();
    expect(
      editorArea.getByRole('combobox', { name: 'Gráfico' }),
      'the new item must be of the graphic on air',
    ).toHaveTextContent('Tarja de entrevista');
    expect(editorArea.getByLabelText('Nome'), 'the name on air must fill the form').toHaveValue(
      'Marina Tavares',
    );
  });

  const clockChoiceScenarios = [
    // Bringing this very clock back later: the moment is kept as the number on air.
    {
      name: 'fills the moment as a typed number with "Continuar este relógio"',
      answer: 'Continuar este relógio',
      expectedMomentKind: 'Valor digitado',
    },
    // A reusable clock item: each take starts it when it goes on air.
    {
      name: 'fills the moment as the moment of each take with "Começar na entrada no ar"',
      answer: 'Começar na entrada no ar',
      expectedMomentKind: 'Momento da entrada no ar',
    },
  ];

  it.each(clockChoiceScenarios)('$name', ({ answer, expectedMomentKind }) => {
    // Arrange: the race clock taken by hand on air, and "Salvar como item" pressed.
    renderCamadasBesideTheRundownWith([
      buildRaceClockInstanceOnTheClockLayer(momentOfTheTakeByHand),
    ]);
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Salvar como item' }));

    // Act: answer the question about the clock.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: answer }));

    // Assert: the editor is open, its moment filled the way the answer said.
    expect(
      findItemEditorArea().getByRole('combobox', {
        name: 'Como preencher Horário da referência (ms desde 1970)',
      }),
      'the moment must be filled as the operator chose',
    ).toHaveTextContent(expectedMomentKind);
  });
});
