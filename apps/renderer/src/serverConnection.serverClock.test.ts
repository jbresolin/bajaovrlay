/**
 * The renderer's connection to the server: learning the server's clock (apps/renderer)
 *
 * What this module is for:
 *   A race clock on air counts from a moment the server stamped with ITS clock, while the
 *   graphic runs on the OBS machine with another clock. Every `hello` and `slice` message
 *   says what the server's clock showed (`serverNowMs`). serverConnection hands each of
 *   those to the shared clock module, which keeps the difference between the two clocks;
 *   graphics then ask readServerAlignedTimeMs() for "now" instead of Date.now().
 *
 * What these tests prove (with the machine's clock faked 2.3 s behind the server's):
 *   - Before any message the shared "now" is the machine's own time.
 *   - After the hello it is the server's time; slice messages keep it there as time passes.
 *   - A program monitor (`?monitor=1`, plain `/ws`) gets the same correction.
 *   - A message without `serverNowMs`, a `commandResult` and the state read over HTTP
 *     give no sample, and nothing breaks.
 *   - One message that spent 850 ms on the network does not move the time read.
 *
 * What these tests deliberately do not cover:
 *   - The median and which samples are kept; packages/shared/src/clock tests.
 *   - The race clock drawing that time; packages/graphics/race-clock's
 *     race-clock.serverClock.test.ts.
 *   - What the connection does with the slices; serverConnection.test.ts.
 */
import { forgetServerClockSamples, readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import {
  createSlicesWithInstances,
  createStateReadAnsweredByHand,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock. */
const serverTimeAtTheHelloMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
const renderMachineLagMs = 2_300;

/**
 * Starts a connection whose socket has just opened, on a machine whose clock is 2.3 s
 * behind the server's. The samples are forgotten before and after, so no test sees the
 * offset of another one. Returns the connection and a way to let time pass on both clocks.
 */
function startConnectionOnAMachineBehindTheServer(
  readStateOverHttp?: (address: string) => Promise<unknown>,
) {
  const connection = startConnectionForTests(readStateOverHttp);
  forgetServerClockSamples();
  onTestFinished(() => forgetServerClockSamples());
  vi.setSystemTime(serverTimeAtTheHelloMs - renderMachineLagMs);
  connection.latestSocket().simulateOpen();
  return connection;
}

/** What the server's clock shows now: the machine's (faked) clock plus the 2.3 s it lags. */
function readServerClockNowMs(): number {
  return Date.now() + renderMachineLagMs;
}

describe('the time of the server clock, learned from its messages', () => {
  it('is the time of the machine itself before any message arrives', () => {
    // Arrange: a connection that has opened its socket and heard nothing yet.
    startConnectionOnAMachineBehindTheServer();

    // Act: ask for the shared "now".
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the machine's own time, 2.3 s behind; nothing has said otherwise yet.
    expect(timeReadMs, 'before the first message there is no correction').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs,
    );
  });

  it('is the time of the server after the hello, on a machine 2.3 s behind', () => {
    // Arrange: a connection on the machine that is 2.3 s behind.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the server greets, saying its clock shows 14:32:05.
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: serverTimeAtTheHelloMs,
    });
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the shared "now" is 14:32:05, not the machine's 14:32:02.700; and the
    // hello was still delivered as always.
    expect(timeReadMs, 'after the hello the shared now must be the server time').toBe(
      serverTimeAtTheHelloMs,
    );
    expect(connection.deliveries, 'the hello must still deliver its slices').toHaveLength(1);
  });

  it('stays on the time of the server as slice messages arrive over a minute', () => {
    // Arrange: a connection that got its hello.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(),
    });

    // Act: every fifteen seconds for a minute the operator changes something, and each
    // slice message says what the server's clock showed.
    for (let messageNumber = 1; messageNumber <= 4; messageNumber += 1) {
      vi.setSystemTime(Date.now() + 15_000);
      connection.latestSocket().simulateMessage({
        type: 'slice',
        name: 'instances',
        slice: [createEnduroClockInstance()],
        serverNowMs: readServerClockNowMs(),
      });
    }
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: one minute after the hello, on the server's clock.
    expect(timeReadMs, 'a minute later the shared now must be 14:33:05 on the server').toBe(
      serverTimeAtTheHelloMs + 60_000,
    );
  });

  it('is not moved by one slice message that spent 850 ms on the network', () => {
    // Arrange: a connection that got its hello and two slice messages without delay.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(),
    });
    for (let messageNumber = 1; messageNumber <= 2; messageNumber += 1) {
      connection.latestSocket().simulateMessage({
        type: 'slice',
        name: 'instances',
        slice: [],
        serverNowMs: readServerClockNowMs(),
      });
    }

    // Act: a slice message built by the server now arrives only 850 ms later.
    const serverClockWhenTheSlowMessageWasBuiltMs = readServerClockNowMs();
    vi.setSystemTime(Date.now() + 850);
    connection.latestSocket().simulateMessage({
      type: 'slice',
      name: 'instances',
      slice: [createEnduroClockInstance()],
      serverNowMs: serverClockWhenTheSlowMessageWasBuiltMs,
    });
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the shared "now" is still exactly the server's; the slow sample is the odd
    // one out of four and the median leaves it aside.
    expect(timeReadMs, 'one slow message must not move the time read').toBe(readServerClockNowMs());
  });

  it('gives a program monitor the same correction', () => {
    // Arrange: the copy of the renderer page the control page frames. It differs from
    // the program renderer only in the address it dials (no role) and in sending nothing.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the monitor's hello arrives.
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: serverTimeAtTheHelloMs,
    });

    // Assert: nothing in the connection depends on the role, so the time read is the
    // server's there too.
    expect(readServerAlignedTimeMs(), 'a monitor must read the server time as well').toBe(
      serverTimeAtTheHelloMs,
    );
  });
});

describe('what gives no sample of the server clock', () => {
  const messagesWithoutASample = [
    // A stand-in server written before the field existed: the schema lets it be left out.
    {
      name: 'a hello that leaves serverNowMs out',
      message: { type: 'hello', slices: createSlicesWithInstances([]) },
    },
    // commandResult never carries the clock (it answers one client, often at once).
    {
      name: 'a commandResult',
      message: { type: 'commandResult', requestId: null, ok: true },
    },
  ];

  it.each(messagesWithoutASample)('leaves the time read alone after $name', ({ message }) => {
    // Arrange: a connection on the machine that is 2.3 s behind.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the message of this row arrives.
    connection.latestSocket().simulateMessage(message);

    // Assert: still the machine's own time, and no warning about the message.
    expect(readServerAlignedTimeMs(), 'no serverNowMs, so no correction').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs,
    );
    expect(connection.readWarnings(), 'such a message is normal, not a problem').toEqual([]);
  });

  it('takes no sample from the state read over HTTP when the hello is late', async () => {
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
    expect(readServerAlignedTimeMs(), 'the HTTP read gives no sample').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs + 3_000,
    );
  });
});
