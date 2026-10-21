/**
 * Item editor: a new item opened with the "Fonte" the manifest suggests (apps/control)
 *
 * What this module is for:
 *   A graphic's manifest may suggest where a field usually reads from
 *   (`v_baja.suggestedBinding`, packages/graphics/README.md). For a new item, the editor
 *   pre-fills that field's "Fonte" when exactly one enabled source has that shape in its
 *   last good data: a tower bound to the simulator costs the operator a label and a
 *   press. Nothing is pre-filled otherwise, so a guess between sources never goes on air.
 *
 * What these tests prove:
 *   - A new tower item on a page where the simulator alone has positions opens with its
 *     cars set to "Fonte", the simulator and "Posições › Lista completa" chosen, live;
 *     and "Salvar item" sends a createItem carrying that binding beside the other
 *     fields at their defaults.
 *   - With the simulator turned off, the same editor opens plain: the cars are "Valor
 *     como está" and nothing is chosen for them.
 *
 * What these tests deliberately do not cover:
 *   - Which sources count and which hints are ignored, case by case:
 *     features/schemaForm/suggestedBindingsOfDataSchema.test.ts.
 *   - The generated form's list field by itself:
 *     features/schemaForm/SchemaFormFieldsListFieldBinding.test.tsx.
 *   - "Salvar e disparar" after the save: ItemEditorPanelSaveAndUse.test.tsx.
 */
import type { DataSource } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import { buildPositionsTowerFixtureGraphic } from '@/state/positionsTowerFixtureGraphic.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';

/** The tower fixture, as the "Gráfico" dropdown names it (its manifest's name). */
const towerGraphicName = 'Torre de posições';

/**
 * The editor for a new item on a page that knows the tower and the race clock, where the
 * simulator (as given) holds the lap-34 data, with the tower chosen by name as its graphic.
 */
function renderNewTowerItemEditorWithTheSimulator(simulator: DataSource) {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServerWithSlices(null, {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildPositionsTowerFixtureGraphic(), buildRaceClockGraphic()],
    dataSources: [simulator],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  });
  chooseGraphicInTheEditor(towerGraphicName);
  return editorOnFakeServer;
}

describe('the item editor for a new tower item', () => {
  it('opens with the cars reading the simulator, as the manifest suggests, and saves that binding', async () => {
    // Arrange: the editor on a page where the simulator alone is on with positions.
    const { fakeServer } = renderNewTowerItemEditorWithTheSimulator(buildSimulatorThatIsOk());
    const kindOfTheCars = screen.getByRole('combobox', { name: 'Como preencher Carros' });
    const sourceOfTheCars = screen.getByRole('combobox', { name: 'Fonte de Carros' });
    const pathOfTheCars = screen.getByRole('combobox', { name: 'O que Carros lê da fonte' });
    const whenOfTheCars = screen.getByRole('combobox', { name: 'Quando Carros lê a fonte' });

    // Act: type a label and press "Salvar item", touching nothing else.
    typeIntoField('Rótulo', 'Torre do enduro');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the editor opened with the suggestion made, and the createItem carries
    // the binding beside the layout and the switches at their defaults.
    expect(kindOfTheCars, 'the cars must open as "Fonte"').toHaveTextContent('Fonte');
    expect(sourceOfTheCars, 'the one source with positions must be chosen').toHaveTextContent(
      'Simulador — Enduro',
    );
    expect(pathOfTheCars, 'the whole positions list must be chosen').toHaveTextContent(
      'Posições › Lista completa',
    );
    expect(whenOfTheCars, 'the suggestion says live').toHaveTextContent('Ao vivo');
    expect(
      fakeServer.listCommandsReceived(),
      'the new item must store the suggested binding and the defaults of the other fields',
    ).toEqual([
      {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: 'sessao-principal' },
        graphicId: 'positions-tower-fixture',
        layerId: 'tower',
        label: 'Torre do enduro',
        color: 'neutral',
        notes: '',
        fields: {
          entries: {
            kind: 'binding',
            sourceId: seededSimulatorId,
            shapeKey: 'positions',
            path: 'entries',
            isLive: true,
          },
          layout: { kind: 'literal', value: 'compact' },
          showGap: { kind: 'literal', value: true },
          showInterval: { kind: 'literal', value: true },
          showPitStops: { kind: 'literal', value: true },
          showFuelStops: { kind: 'literal', value: false },
        },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('opens plain when the only source with positions is turned off', () => {
    // Arrange: the same page, with the simulator off.

    // Act: draw the editor for a new tower item.
    renderNewTowerItemEditorWithTheSimulator(buildSeededSimulatorThatIsOff());

    // Assert: the cars are left as they are, and nothing is chosen for them.
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Carros' }),
      'with no source to suggest, the cars must open as "Valor como está"',
    ).toHaveTextContent('Valor como está');
    expect(
      screen.queryByRole('combobox', { name: 'Fonte de Carros' }),
      'no source control is drawn while the cars are not read from a source',
    ).toBeNull();
  });
});
