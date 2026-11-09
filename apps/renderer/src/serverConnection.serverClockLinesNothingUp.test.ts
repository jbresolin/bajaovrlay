/**
 * The renderer's connection to the server: what does not line up its clock (apps/renderer)
 *
 * What this module is for:
 *   The renderer lines its page up with the server clock through a hello and clock probes
 *   only (BAJAOVRLAY-62; serverConnection.serverClock.test.ts). Other messages carry
 *   times too, one-way and late by their size and transit; taking them would move a race
 *   clock on air back and forth.
 *
 * What these tests prove (the machine's clock faked 2.3 s behind the server's; a stand-in
 *   server answers each probe after 6 ms):
 *   - The time a `slice` carries does not move the time read.
 *   - A hello without `serverNowMs` (a stand-in server's) lines nothing up by itself; the
 *     probes it sends do.
 *   - A `commandResult` and the state read over HTTP line nothing up.
 *
 * What these tests deliberately do not cover:
 *   - The hello, the probes and the `time` message; serverConnection.serverClock.test.ts.
 */
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { describe, expect, it, vi } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import {
  createSlicesWithInstances,
  createStateReadAnsweredByHand,
} from './serverConnection.testSupport.js';
import {
  answerEveryClockProbe,
  readServerClockNowMs,
  renderMachineLagMs,
  serverTimeAtTheHelloMs,
  startConnectionOnAMachineBehindTheServer,
} from './serverConnectionServerClock.testSupport.js';

describe('what lines nothing up', () => {
  it("leaves the time read alone after a slice's own time", () => {
    // Arrange: a connection lined up at its hello and probes.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(),
    });
    answerEveryClockProbe(connection.latestSocket());

    // Act: a slice message arrives that spent 850 ms on the network, carrying the time it
    // was built at.
    const serverClockWhenTheSliceWasBuiltMs = readServerClockNowMs();
    vi.advanceTimersByTime(850);
    connection.latestSocket().simulateMessage({
      type: 'slice',
      name: 'instances',
      slice: [createEnduroClockInstance()],
      serverNowMs: serverClockWhenTheSliceWasBuiltMs,
    });

    // Assert: still exactly the server's time: only the hello and the probes line up.
    expect(readServerAlignedTimeMs(), 'a slow slice must not move the time read').toBe(
      readServerClockNowMs(),
    );
  });

  it('lines up from the probes alone after a hello without serverNowMs', () => {
    // Arrange: a stand-in server whose hello leaves the time out.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });
    const timeReadBeforeTheProbesMs = readServerAlignedTimeMs();

    // Act: the probe the hello sent is answered, and the ones after it.
    answerEveryClockProbe(connection.latestSocket());

    // Assert: the machine's own time until then; the server's after.
    expect(timeReadBeforeTheProbesMs, 'no serverNowMs, so no correction yet').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs,
    );
    expect(readServerAlignedTimeMs(), 'the probes line the page up').toBe(readServerClockNowMs());
  });

  it('leaves the time read alone after a commandResult, with no warning', () => {
    // Arrange: a connection on the machine that is 2.3 s behind.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: a commandResult arrives (it answers an instanceStatus).
    connection.latestSocket().simulateMessage({ type: 'commandResult', requestId: null, ok: true });

    // Assert: still the machine's own time, and no warning.
    expect(readServerAlignedTimeMs(), 'a commandResult carries no clock').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs,
    );
    expect(connection.readWarnings(), 'such a message is normal, not a problem').toEqual([]);
  });

  it('lines nothing up from the state read over HTTP when the hello is late', async () => {
    // Arrange: a connection whose hello never comes, and a state read answered by hand.
    const stateRead = createStateReadAnsweredByHand();
    const connection = startConnectionOnAMachineBehindTheServer(stateRead.readStateOverHttp);

    // Act: three seconds pass, the state is read over HTTP and answered.
    await vi.advanceTimersByTimeAsync(3_000);
    stateRead.answerWith(createSlicesWithInstances([createEnduroClockInstance()]));
    await vi.advanceTimersByTimeAsync(0);

    // Assert: the slices were delivered, but GET /api/v1/state carries no clock, so the
    // time read is still the machine's own (now three seconds on).
    expect(connection.deliveries, 'the state read must deliver the slices').toHaveLength(1);
    expect(readServerAlignedTimeMs(), 'the HTTP read lines nothing up').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs + 3_000,
    );
  });
});
