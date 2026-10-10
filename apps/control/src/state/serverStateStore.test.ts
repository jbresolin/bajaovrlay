/**
 * Server state store (apps/control)
 *
 * What this module is for:
 *   The control page never owns state: the server sends it as four "slices" (layers,
 *   graphics, instances, event log) and the page only mirrors them. This store is the
 *   one place that mirror lives, together with two facts about the page itself: whether
 *   the connection is up, and why the last command failed.
 *
 * What these tests prove:
 *   - A new store is empty and says the page is still connecting.
 *   - A hello replaces every slice; a slice message replaces exactly that slice, whole,
 *     and leaves the others alone.
 *   - The connection status moves connecting → connected → reconnecting → connected.
 *   - The last command error is remembered and can be forgotten again.
 *
 * What these tests deliberately do not cover:
 *   - Where the messages come from: serverConnection.test.ts covers the WebSocket.
 *   - How components read the store; the component tests cover that.
 */
import { describe, expect, it } from 'vitest';

import { createServerStateStore } from './serverStateStore';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
  buildSlicesWithTheRaceClockOnAir,
} from './slicesLikeTheServerSends.testSupport';

const momentTheClockWentOnAir = '2026-10-09T13:00:00.000Z';

describe('a new store', () => {
  it('starts with empty slices, still connecting and with no command error', () => {
    // Arrange: nothing to prepare.

    // Act: build the store, as the page does when it opens.
    const serverStateStore = createServerStateStore();

    // Assert: nothing is known yet, and the page says it is connecting.
    const state = serverStateStore.getState();
    expect(state.layers, 'no layers are known before the server says hello').toEqual([]);
    expect(state.graphics, 'no graphics are known before the server says hello').toEqual([]);
    expect(state.instances, 'nothing is on air before the server says hello').toEqual([]);
    expect(state.eventLog, 'the event log is empty before the server says hello').toEqual([]);
    expect(state.connectionStatus, 'a page that just opened is still connecting').toBe(
      'connecting',
    );
    expect(state.lastCommandError, 'no command has failed yet').toBeNull();
  });
});

describe('slices arriving from the server', () => {
  it('replaces every slice when the server says hello', () => {
    // Arrange: a store that already believes the race clock is on air.
    const serverStateStore = createServerStateStore();
    serverStateStore
      .getState()
      .replaceEverySlice(buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir));

    // Act: a hello arrives from a server on which nothing is on air.
    serverStateStore.getState().replaceEverySlice(buildSlicesWithNothingOnAir());

    // Assert: the store holds exactly what the hello said, with no leftovers.
    const state = serverStateStore.getState();
    expect(state.instances, 'the old instance must be gone after the hello').toEqual([]);
    expect(
      state.layers.map((layer) => layer.name),
      'the layers must be the five the server sent',
    ).toEqual(['Logo', 'Letreiro', 'Relógio', 'Tarja', 'Tela cheia']);
    expect(
      state.graphics.map((graphic) => graphic.id),
      'the graphics must be the ones the server sent',
    ).toEqual(['race-clock']);
  });

  it('replaces one slice wholesale and leaves the other slices alone', () => {
    // Arrange: a store that knows the server's layers and has nothing on air.
    const serverStateStore = createServerStateStore();
    serverStateStore.getState().replaceEverySlice(buildSlicesWithNothingOnAir());
    const layersBeforeTheMessage = serverStateStore.getState().layers;

    // Act: the server says the instances slice is now "the race clock on the clock layer".
    serverStateStore.getState().replaceOneSlice({
      type: 'slice',
      name: 'instances',
      slice: [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)],
    });

    // Assert: instances is the new list, and layers is untouched.
    const state = serverStateStore.getState();
    expect(state.instances, 'the instances slice must be exactly what the server sent').toEqual([
      buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
    ]);
    expect(state.layers, 'a message about instances must not touch the layers').toBe(
      layersBeforeTheMessage,
    );
  });

  it('drops what a slice held before, instead of merging the new list into it', () => {
    // Arrange: a store that believes the race clock is on air.
    const serverStateStore = createServerStateStore();
    serverStateStore
      .getState()
      .replaceEverySlice(buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir));

    // Act: the server says the instances slice is now empty (the layer was cleared).
    serverStateStore.getState().replaceOneSlice({ type: 'slice', name: 'instances', slice: [] });

    // Assert: nothing is on air any more.
    expect(
      serverStateStore.getState().instances,
      'an empty slice from the server must empty the slice here',
    ).toEqual([]);
  });
});

describe('the connection status', () => {
  it('moves from connecting to connected, to reconnecting and back to connected', () => {
    // Arrange: a new store, and a list to note each status in turn.
    const serverStateStore = createServerStateStore();
    const statusesSeen = [serverStateStore.getState().connectionStatus];

    // Act: the server answers, then the line drops, then the server answers again.
    serverStateStore.getState().changeConnectionStatus('connected');
    statusesSeen.push(serverStateStore.getState().connectionStatus);
    serverStateStore.getState().changeConnectionStatus('reconnecting');
    statusesSeen.push(serverStateStore.getState().connectionStatus);
    serverStateStore.getState().changeConnectionStatus('connected');
    statusesSeen.push(serverStateStore.getState().connectionStatus);

    // Assert: each change was stored, in order.
    expect(statusesSeen, 'the status must follow the life of the connection').toEqual([
      'connecting',
      'connected',
      'reconnecting',
      'connected',
    ]);
  });

  it('keeps the slices it has while reconnecting, so the page does not go blank', () => {
    // Arrange: a connected store with the race clock on air.
    const serverStateStore = createServerStateStore();
    serverStateStore
      .getState()
      .replaceEverySlice(buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir));
    serverStateStore.getState().changeConnectionStatus('connected');

    // Act: the line drops.
    serverStateStore.getState().changeConnectionStatus('reconnecting');

    // Assert: the last known state is still there for the operator to read.
    expect(
      serverStateStore.getState().instances,
      'losing the connection must not erase what the operator last saw',
    ).toHaveLength(1);
  });
});

describe('the last command error', () => {
  it('remembers why a command failed and forgets it when asked', () => {
    // Arrange: a store, and the refusal the server gives for a graphic it does not know.
    const serverStateStore = createServerStateStore();
    const refusalForUnknownGraphic = {
      commandType: 'takeGraphic',
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "race-clock" não está registrado.',
    } as const;

    // Act: remember the refusal, read it, then forget it.
    serverStateStore.getState().rememberCommandError(refusalForUnknownGraphic);
    const errorWhileRemembered = serverStateStore.getState().lastCommandError;
    serverStateStore.getState().forgetCommandError();
    const errorAfterForgetting = serverStateStore.getState().lastCommandError;

    // Assert: the refusal was there, and then it was gone.
    expect(errorWhileRemembered, 'the store must hold the refusal exactly as given').toEqual(
      refusalForUnknownGraphic,
    );
    expect(errorAfterForgetting, 'a forgotten error must leave nothing behind').toBeNull();
  });
});
