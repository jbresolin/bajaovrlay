/**
 * Camadas: "Salvar no item" on an item that reads a source (apps/control)
 *
 * What this module is for:
 *   "Salvar no item" writes into the item what was changed on air. A field the item reads
 *   from a source ("Fonte", or "Relógio da fonte" for the whole clock) keeps its binding:
 *   the server skips it (gate 2 of PR #18), and the page tells the operator which fields
 *   were not saved and why, in pt-BR, once the save is accepted.
 *
 * What these tests prove:
 *   - With a typed title and a bound flag changed on air, the save is sent and then the
 *     page names the flag as not saved because it reads a source.
 *   - A clock stopped on air whose item reads the whole clock does not ask the clock
 *     question (nothing of the clock will be saved) and names the clock fields.
 *   - A save of typed fields only shows no such line.
 *
 * What these tests deliberately do not cover:
 *   - What the server saves; saveOnAirChangesIntoItemBindings.test.ts in apps/server.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const idOfTheClockOnAir = '9a4c1e7f-3b5d-4e20-8f6a-2c7b9d1e5f38';

/** A live binding to the simulator's session at the path given. */
function bindToTheSimulatorSession(path: string) {
  return {
    kind: 'binding' as const,
    sourceId: 'simulador-enduro',
    shapeKey: 'session' as const,
    path,
    isLive: true,
  };
}

/** The start clock with its flag and whole clock read from the simulator. */
function buildStartClockItemReadingTheSimulator(): Item {
  const item = buildEnduranceStartClockItem();
  return {
    ...item,
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: bindToTheSimulatorSession('state'),
      referenceTimeMs: bindToTheSimulatorSession('clock'),
    },
  };
}

/** The bound start clock on air with these fields changed on air. */
function buildClockOnAirChanged(item: Item, fieldsChangedOnAir: string[]): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheClockOnAir,
    item: buildEnduranceStartClockItem(),
    layerId: 'clock',
    target: 'program',
    takenAt: '2026-10-10T13:00:00.000Z',
  });
  return { ...instance, itemId: item.id, fieldsChangedOnAir };
}

/** Draws Camadas with this item and its instance on air. */
function renderCamadasWith(item: Item, instance: Instance) {
  return renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items: [item],
    instances: [instance],
  });
}

/** Presses "Salvar no item" on the clock's row. */
function pressSaveIntoItemOnTheClock(): void {
  const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
  fireEvent.click(clockRow.getByRole('button', { name: 'Salvar no item' }));
}

describe('"Salvar no item" with fields the item reads from a source', () => {
  it('names the flag it did not save because the item reads it from a source', async () => {
    // Arrange: the title retyped and the flag set by hand on air.
    const item = buildStartClockItemReadingTheSimulator();
    const { fakeServer } = renderCamadasWith(
      item,
      buildClockOnAirChanged(item, ['sessionName', 'state']),
    );

    // Act: save into the item; the server accepts.
    pressSaveIntoItemOnTheClock();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the save is sent').toHaveLength(1);
    });
    fakeServer.acceptLastCommand();

    // Assert: the flag is named, the title is not.
    expect(
      await screen.findByText('Não salvo no item, porque o item lê da fonte: Bandeira.'),
      'the operator must be told the flag was not saved',
    ).toBeVisible();
  });

  it('asks no clock question for a whole clock read from the source', async () => {
    // Arrange: the bound clock stopped by hand on air.
    const item = buildStartClockItemReadingTheSimulator();
    const { fakeServer } = renderCamadasWith(item, buildClockOnAirChanged(item, ['running']));

    // Act: save into the item; the server accepts.
    pressSaveIntoItemOnTheClock();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the save is sent at once').toHaveLength(1);
    });
    fakeServer.acceptLastCommand();

    // Assert: no question was needed, and the clock fields are named.
    expect(screen.queryByRole('dialog'), 'nothing of the clock will be saved').toBeNull();
    expect(
      await screen.findByText(/^Não salvo no item, porque o item lê da fonte: /),
      'the clock fields must be named',
    ).toHaveTextContent('Tempo de referência');
  });

  it('shows no such line for typed fields only', async () => {
    // Arrange: only the typed title changed on air.
    const item = buildStartClockItemReadingTheSimulator();
    const { fakeServer } = renderCamadasWith(item, buildClockOnAirChanged(item, ['sessionName']));

    // Act: save into the item; the server accepts.
    pressSaveIntoItemOnTheClock();
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the save is sent').toHaveLength(1);
    });
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: everything was saved; nothing to say.
    expect(
      screen.queryByText(/^Não salvo no item/),
      'no line when every field was saved',
    ).toBeNull();
  });
});
