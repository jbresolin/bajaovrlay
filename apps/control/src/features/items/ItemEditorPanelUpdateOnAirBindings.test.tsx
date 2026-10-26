/**
 * "Atualizar no ar" after a field switched to a data source (apps/control)
 *
 * What this module is for:
 *   An item on air can be edited and its typed changes put on air at once ("Atualizar no
 *   ar"). A field switched to "Fonte" or "Relógio da fonte" has no typed value: the item
 *   stores the binding, and the source's value reaches the air at the next take. Gate 2 of
 *   PR #18 found the press refused every time after a switch to "Relógio da fonte": the
 *   editor sent the three clock fields as null. Here the press sends typed values only,
 *   and a note tells the operator that the source change waits for the next take.
 *
 * What these tests prove:
 *   - After a switch to "Relógio da fonte" the note shows, the item is saved with the
 *     whole clock, and no on-air update is sent at all.
 *   - After a switch of the flag to "Fonte" and a new title, the on-air update carries the
 *     title only.
 *   - With typed changes only, there is no note.
 *   - A list field on "Lista dos cadastros" switched from the sponsors to the schedule
 *     shows the note too (gate 2 round 1 of PR #29: missed since PR #28).
 *
 * What these tests deliberately do not cover:
 *   - Which keys are left out, row by row; fieldsReadFromASource.test.ts.
 *   - The server releasing a live binding typed over on air;
 *     instanceBindingsAfterAnOnAirEdit.test.ts in apps/server.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildLibraryOfThe30thCompetition } from '@/features/schemaForm/boardWithEntityListsFixtureSchema.testSupport';
import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  idOfTheInstanceTakenFromTheItem,
  momentTheItemWasTaken,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForCommandsReceived,
  waitForThePageToDealWithTheLastAnswer,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

const noteOfTheNextTake = 'A mudança de fonte entra no ar na próxima entrada.';

/** The editor for the endurance clock on air, on a page that knows the simulator. */
function renderEditorForTheTypedClockOnAir() {
  const itemOnAir: Item = buildEnduranceStartClockItem();
  return renderItemEditorPanelOnFakeServerWithSlices(itemOnAir, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items: [itemOnAir],
    instances: [
      buildInstanceTakenFromItem({
        id: idOfTheInstanceTakenFromTheItem,
        item: itemOnAir,
        layerId: 'clock',
        target: 'program',
        takenAt: momentTheItemWasTaken,
      }),
    ],
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  });
}

/**
 * An intermission board whose one list takes any record of the library (its items are
 * objects that name no required key), so both the sponsors and the schedule fit it.
 */
function buildBoardOfAnyListGraphic(): Graphic {
  return {
    id: 'intermission-board-fixture',
    manifest: {
      id: 'baja-intermission-board-fixture',
      name: 'Quadro do intervalo',
      main: 'intermission-board-fixture.js',
      schema: {
        type: 'object',
        properties: {
          boardItems: { type: 'array', title: 'Itens do quadro', items: { type: 'object' } },
        },
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'fullscreen',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The editor for that board on air, its list reading the sponsors from Cadastros. */
function renderEditorForTheBoardOfSponsorsOnAir() {
  const itemOnAir: Item = {
    id: '4c8e1f27-9a3d-4b56-8e01-2f7a6c9d3b14',
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'intermission-board-fixture',
    layerId: 'fullscreen',
    fields: { boardItems: { kind: 'entityList', entityType: 'sponsor' } },
    label: 'Intervalo — patrocinadores',
    color: 'neutral',
    notes: '',
  };
  return renderItemEditorPanelOnFakeServerWithSlices(itemOnAir, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    ...buildLibraryOfThe30thCompetition(),
    graphics: [buildBoardOfAnyListGraphic()],
    items: [itemOnAir],
    instances: [
      buildInstanceTakenFromItem({
        id: idOfTheInstanceTakenFromTheItem,
        item: itemOnAir,
        layerId: 'fullscreen',
        target: 'program',
        takenAt: momentTheItemWasTaken,
      }),
    ],
  });
}

describe('"Atualizar no ar" with a field switched to a source', () => {
  it('saves "Relógio da fonte", says it waits for the take and sends nothing on air', async () => {
    // Arrange: the typed clock on air, its time switched to the simulator's clock.
    const { fakeServer, onClose } = renderEditorForTheTypedClockOnAir();
    chooseOptionInDropdown('Como preencher Tempo de referência', 'Relógio da fonte');
    chooseOptionInDropdown('Fonte de Tempo de referência', 'Simulador — Enduro');
    const noteBeforeThePress = screen.queryByText(noteOfTheNextTake);

    // Act: press "Atualizar no ar"; the server accepts the save.
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForThePageToDealWithTheLastAnswer();

    // Assert: the note was there; only the save was sent, and the editor closes.
    expect(noteBeforeThePress, 'the operator must be told it waits for the take').toBeVisible();
    expect(
      fakeServer.listCommandsReceived().map((command) => (command as { type: string }).type),
      'no on-air update may carry the clock fields as null',
    ).toEqual(['updateItemFields']);
    await waitFor(() => {
      expect(onClose, 'the editor closes after the accepted save').toHaveBeenCalledTimes(1);
    });
  });

  it('sends the new title on air and leaves the flag that now reads a source', async () => {
    // Arrange: the typed clock on air; its flag now reads the simulator, its title retyped.
    const { fakeServer } = renderEditorForTheTypedClockOnAir();
    chooseOptionInDropdown('Como preencher Bandeira', 'Fonte');
    chooseOptionInDropdown('Fonte de Bandeira', 'Simulador — Enduro');
    chooseOptionInDropdown('O que Bandeira lê da fonte', 'Sessão › Bandeira');
    typeIntoField('Título', 'Enduro — Etapa Nacional');

    // Act: press "Atualizar no ar"; the server accepts the save.
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Assert: the on-air update carries the typed title alone.
    expect(fakeServer.listCommandsReceived()[1], 'the typed title only goes on air now').toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheInstanceTakenFromTheItem,
      data: { sessionName: 'Enduro — Etapa Nacional' },
      takeTimeFieldKeys: [],
    });
  });

  it('shows no note for typed changes only', () => {
    // Arrange: the typed clock on air.
    renderEditorForTheTypedClockOnAir();

    // Act: retype the title.
    typeIntoField('Título', 'Enduro — Etapa Nacional');

    // Assert: a typed change goes on air at once; nothing waits for the take.
    expect(screen.queryByText(noteOfTheNextTake), 'no note for typed changes').toBeNull();
  });

  it('says it waits for the take when a list from Cadastros switches to the other list', () => {
    // Arrange: the board on air, its list reading the sponsors.
    renderEditorForTheBoardOfSponsorsOnAir();
    const noteBeforeTheSwitch = screen.queryByText(noteOfTheNextTake);

    // Act: switch the list to the schedule.
    chooseOptionInDropdown('Lista dos cadastros de Itens do quadro', 'Programação');

    // Assert: no note before; the note once the list read changed.
    expect(noteBeforeTheSwitch, 'nothing waits for the take before the switch').toBeNull();
    expect(
      screen.getByText(noteOfTheNextTake),
      'another list reaches the air at the next take only',
    ).toBeVisible();
  });
});
