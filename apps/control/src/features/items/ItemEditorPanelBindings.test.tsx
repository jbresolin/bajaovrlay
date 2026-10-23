/**
 * The item editor and fields read from a data source (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-20 lets an item field read a source instead of holding a typed value. The
 *   item editor's per-field kind selector gains "Fonte" wherever some bindable path fits
 *   the field, and the race clock's time gains "Relógio da fonte" (the whole session
 *   clock, filling the four clock fields at once). Choosing "Fonte" shows the source, the
 *   path (only those that fit the field), "Ao vivo / Congelado na entrada", the transform,
 *   and a line saying what the field would get now.
 *
 * What these tests prove:
 *   - "Fonte" is offered for the race clock's flag, and "Relógio da fonte" only on its
 *     time field; a field no path fits (the lower third's social networks) offers neither.
 *   - The path list of the flag holds the session flag and not the clock's running switch.
 *   - The line under the binding shows the flag the simulator sends now, in pt-BR words.
 *   - Saving sends the flag binding exactly as chosen, frozen at the take.
 *   - "Relógio da fonte" saves one whole-clock binding on the time field and nothing on
 *     the three other clock fields.
 *
 * What these tests deliberately do not cover:
 *   - Which paths and transforms fit which field, row by row; bindingChoices.test.ts.
 *   - The server's check of the save; itemBindingFields.test.ts in apps/server.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  raceClockGraphicName,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/**
 * The editor for a new item on a page that knows the simulator and its lap-34 data,
 * with the race clock chosen by name as its graphic.
 */
function renderNewItemEditorWithTheSimulator() {
  const editorOnFakeServer = renderItemEditorPanelOnFakeServerWithSlices(null, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  });
  chooseGraphicInTheEditor(raceClockGraphicName);
  return editorOnFakeServer;
}

/** The options a dropdown offers, by its accessible name, as the operator reads them. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

/** Sets the race clock's flag to read the simulator's session flag. */
function bindTheFlagToTheSimulator(): void {
  chooseOptionInDropdown('Como preencher Bandeira', 'Fonte');
  chooseOptionInDropdown('Fonte de Bandeira', 'Simulador — Enduro');
  chooseOptionInDropdown('O que Bandeira lê da fonte', 'Sessão › Bandeira');
}

describe('the kind selector of the item editor with data sources', () => {
  it('offers "Fonte" on the flag, and "Relógio da fonte" only on the time', () => {
    // Arrange: a new race clock item on a page that knows the simulator.
    renderNewItemEditorWithTheSimulator();

    // Act: read the kinds offered for the flag and for the reference time.
    const kindsOfTheFlag = readOptionsOfDropdown('Como preencher Bandeira');
    const kindsOfTheTime = readOptionsOfDropdown('Como preencher Tempo de referência');

    // Assert: "Fonte" on both; the whole clock only where the time is. "Evento" closes
    // both lists: a text and a number may also be filled by an event (BAJAOVRLAY-44).
    expect(kindsOfTheFlag, 'the flag can be typed or read from a source').toEqual([
      'Valor digitado',
      'Fonte',
      'Evento',
    ]);
    expect(kindsOfTheTime, 'the time can also read the whole clock').toEqual([
      'Valor digitado',
      'Fonte',
      'Relógio da fonte',
      'Evento',
    ]);
  });

  it('offers nothing to read for a field no path fits', () => {
    // Arrange: the same editor; the lower third's social networks are an object.
    renderNewItemEditorWithTheSimulator();

    // Act: choose the lower third instead of the race clock.
    chooseOptionInDropdown('Gráfico', 'Tarja de entrevista');

    // Assert: no kind selector for the social networks, so no "Fonte".
    expect(
      screen.queryByRole('combobox', { name: 'Como preencher Redes sociais' }),
      'an object field has nothing to read from a source',
    ).toBeNull();
  });
});

describe('the binding controls of a field', () => {
  it('lists the session flag for the flag, and not the clock running switch', () => {
    // Arrange: the flag set to read the simulator.
    renderNewItemEditorWithTheSimulator();
    chooseOptionInDropdown('Como preencher Bandeira', 'Fonte');
    chooseOptionInDropdown('Fonte de Bandeira', 'Simulador — Enduro');

    // Act: read the paths offered.
    const pathsOffered = readOptionsOfDropdown('O que Bandeira lê da fonte');

    // Assert: filtered by the field's type.
    expect(pathsOffered, 'the session flag fits a flag').toContain('Sessão › Bandeira');
    expect(pathsOffered, 'a yes/no does not fit a flag').not.toContain(
      'Sessão › Relógio › Correndo',
    );
  });

  it('shows the flag the simulator sends now', () => {
    // Arrange: the editor with the simulator under green at lap 34.
    renderNewItemEditorWithTheSimulator();

    // Act: bind the flag.
    bindTheFlagToTheSimulator();

    // Assert: the line under the binding reads the value of now, the flag in words.
    expect(
      screen.getByText('Valor agora: Verde'),
      'the value of now must be shown in pt-BR',
    ).toBeVisible();
  });

  it('saves the flag binding as chosen, frozen at the take', async () => {
    // Arrange: a new race clock item with its flag bound and frozen.
    const { fakeServer } = renderNewItemEditorWithTheSimulator();
    typeIntoField('Rótulo', 'Relógio do enduro — fonte');
    bindTheFlagToTheSimulator();
    chooseOptionInDropdown('Quando Bandeira lê a fonte', 'Congelado na entrada');

    // Act: save.
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the flag stored as a binding of the session flag, not live.
    const createItem = fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> };
    expect(createItem.fields.state, 'the flag binding as chosen').toEqual({
      kind: 'binding',
      sourceId: seededSimulatorId,
      shapeKey: 'session',
      path: 'state',
      isLive: false,
    });
  });

  it('saves "Relógio da fonte" as one binding on the time, and nothing on the other clock fields', async () => {
    // Arrange: a new race clock item whose time reads the whole clock of the simulator.
    const { fakeServer } = renderNewItemEditorWithTheSimulator();
    typeIntoField('Rótulo', 'Relógio do enduro — fonte');
    chooseOptionInDropdown('Como preencher Tempo de referência', 'Relógio da fonte');
    chooseOptionInDropdown('Fonte de Tempo de referência', 'Simulador — Enduro');

    // Act: save.
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the whole clock on the time field; the moment, running and mode left out.
    const createItem = fakeServer.listCommandsReceived()[0] as { fields: Record<string, unknown> };
    expect(createItem.fields.referenceTimeMs, 'one whole-clock binding').toEqual({
      kind: 'binding',
      sourceId: seededSimulatorId,
      shapeKey: 'session',
      path: 'clock',
      isLive: true,
    });
    expect(
      Object.keys(createItem.fields).filter((fieldKey) =>
        ['referenceWallClockMs', 'running', 'clockMode'].includes(fieldKey),
      ),
      'the whole clock fills the other three clock fields',
    ).toEqual([]);
  });
});
