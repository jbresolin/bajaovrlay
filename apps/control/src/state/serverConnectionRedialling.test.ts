/**
 * Server connection: losing the line and getting it back (apps/control)
 *
 * What this module is for:
 *   A race weekend's network is not kind: the server restarts, a cable is pulled, the
 *   Wi-Fi drops. The control page must say so, keep showing the last thing it knew, and
 *   get back by itself without the operator reloading anything.
 *
 * What these tests prove:
 *   - When the line drops the page says "reconnecting" and keeps its last known state.
 *   - It dials again after a wait that doubles each time (0.5 s, 1 s, 2 s, 4 s) and
 *     then stays at 5 s, never dialling early.
 *   - A hello after a drop makes the page connected again, showing the server's state,
 *     and the next outage starts over from the short 0.5 s wait.
 *   - Hanging up on purpose stops the dialling.
 *
 * What these tests deliberately do not cover:
 *   - Commands that were waiting for an answer when the line dropped: nothing special
 *     happens to them; they fail after their usual 5 seconds (serverConnection.test.ts).
 *   - The browser's real WebSocket and the real clock: a fake server socket stands in,
 *     and time is moved by hand.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  connectControlPageToFakeServer,
  connectControlPageToFakeServerThatSaidHello,
} from './connectionToFakeServer.testSupport';
import {
  buildSlicesWithNothingOnAir,
  buildSlicesWithTheRaceClockOnAir,
} from './slicesLikeTheServerSends.testSupport';

const momentTheClockWentOnAir = '2026-10-09T13:00:00.000Z';

describe('losing the connection', () => {
  it('says reconnecting and keeps the last known state when the line drops', () => {
    // Arrange: a connected page with the race clock on air.
    vi.useFakeTimers();
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Act: the line drops.
    fakeServerSocket.dropConnection();

    // Assert: the page says so, and still shows what it last knew.
    const state = serverStateStore.getState();
    expect(state.connectionStatus, 'a dropped line means the page is reconnecting').toBe(
      'reconnecting',
    );
    expect(state.instances, 'the last known instances must stay on screen').toHaveLength(1);
  });

  it('dials again after waits of 0.5 s, 1 s, 2 s, 4 s and then 5 s at most', () => {
    // Arrange: a connected page whose line has just dropped, with time moved by hand.
    vi.useFakeTimers();
    const { fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();
    fakeServerSocket.dropConnection();
    const waitsBeforeEachNewCallInMilliseconds = [500, 1_000, 2_000, 4_000, 5_000, 5_000];
    const callsCountedJustBeforeEachWaitEnded: number[] = [];
    const callsCountedRightAfterEachWaitEnded: number[] = [];

    // Act: for each wait, go to one millisecond before its end, then to its end; every
    // new call fails straight away (the server is still down), which starts the next wait.
    for (const waitInMilliseconds of waitsBeforeEachNewCallInMilliseconds) {
      vi.advanceTimersByTime(waitInMilliseconds - 1);
      callsCountedJustBeforeEachWaitEnded.push(fakeServerSocket.countConnectionsOpened());
      vi.advanceTimersByTime(1);
      callsCountedRightAfterEachWaitEnded.push(fakeServerSocket.countConnectionsOpened());
      fakeServerSocket.dropConnection();
    }

    // Assert: no call is made early, and exactly one is made when each wait ends.
    expect(
      callsCountedJustBeforeEachWaitEnded,
      'no new call may go out before its wait is over',
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      callsCountedRightAfterEachWaitEnded,
      'one new call must go out when each wait ends',
    ).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('is connected again, with fresh state, once the server says hello after a drop', () => {
    // Arrange: a page that showed nothing on air, lost the line and has dialled again.
    vi.useFakeTimers();
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(500);

    // Act: the server picks up and says hello; meanwhile the race clock went on air.
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Assert: connected, and showing the server's state rather than the old one.
    const state = serverStateStore.getState();
    expect(state.connectionStatus, 'a hello after a drop means connected again').toBe('connected');
    expect(state.instances, 'the state must be the one from the new hello').toHaveLength(1);
  });

  it('starts the waits over from 0.5 s after a successful reconnection', () => {
    // Arrange: a page that needed three calls to get back (waits of 0.5 s and 1 s).
    vi.useFakeTimers();
    const { fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(500);
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(1_000);
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({ type: 'hello', slices: buildSlicesWithNothingOnAir() });
    const callsBeforeTheSecondOutage = fakeServerSocket.countConnectionsOpened();

    // Act: the line drops again, and half a second passes.
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(500);

    // Assert: the page has already dialled again, instead of waiting 2 s.
    expect(
      fakeServerSocket.countConnectionsOpened(),
      'after a good connection the first retry must come after 0.5 s again',
    ).toBe(callsBeforeTheSecondOutage + 1);
  });

  it('stops dialling once the connection is closed on purpose', () => {
    // Arrange: a connected page, with time moved by hand.
    vi.useFakeTimers();
    const { fakeServerSocket, serverConnection } = connectControlPageToFakeServerThatSaidHello();

    // Act: the page hangs up (as when its tab closes), the socket closes, a minute passes.
    serverConnection.close();
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(60_000);

    // Assert: the only call ever made is the first one.
    expect(
      fakeServerSocket.countConnectionsOpened(),
      'a page that hung up on purpose must not dial again',
    ).toBe(1);
  });
});
