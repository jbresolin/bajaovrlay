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
 *   - A `time` message, which the server sends every ten seconds, gives a sample exactly
 *     as a hello does, and the renderer does nothing else with it: no delivery, no log line.
 *   - A message without `serverNowMs`, a `commandResult` and the state read over HTTP
 *     give no sample, and nothing breaks. "No sample" is not "offset zero": before any
 *     sample the time read stays the machine's own, and a correction already learned is
 *     left exactly as it was.
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

describe('the time message the server sends every ten seconds', () => {
  it('gives a sample exactly as a hello does, on a page that had none', () => {
    // Arrange: a connection on the machine that is 2.3 s behind, which has heard nothing.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the server's ten-second time message arrives, saying 14:32:05.
    connection.latestSocket().simulateMessage({
      type: 'time',
      serverNowMs: serverTimeAtTheHelloMs,
    });

    // Assert: the shared "now" is the server's time.
    expect(readServerAlignedTimeMs(), 'a time message must correct the time read').toBe(
      serverTimeAtTheHelloMs,
    );
  });

  it('keeps the time read on the server clock through a quiet minute with no slice message', () => {
    // Arrange: a connection that got its hello; then nothing changes on the server.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: readServerClockNowMs(),
    });

    // Act: twenty seconds in, a time sync moves this machine's clock 5 s further back
    // (it is now 7.3 s behind the server); the time messages keep coming every ten
    // seconds until the minute is over, each saying what the server's clock shows.
    let lagOfThisMachineMs = renderMachineLagMs;
    for (let secondsSinceTheHello = 10; secondsSinceTheHello <= 60; secondsSinceTheHello += 10) {
      vi.setSystemTime(Date.now() + 10_000);
      if (secondsSinceTheHello === 20) {
        vi.setSystemTime(Date.now() - 5_000);
        lagOfThisMachineMs = renderMachineLagMs + 5_000;
      }
      connection.latestSocket().simulateMessage({
        type: 'time',
        serverNowMs: Date.now() + lagOfThisMachineMs,
      });
    }

    // Assert: a minute after the hello the time read is the server's again, although no
    // slice changed in between. Without the time messages it would be 5 s behind.
    expect(
      readServerAlignedTimeMs(),
      'the time messages alone must bring the time read back to the server clock',
    ).toBe(serverTimeAtTheHelloMs + 60_000);
  });

  it('does nothing else with it: no delivery and no log line', () => {
    // Arrange: a connection that got its hello, and how many log lines it has written.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: serverTimeAtTheHelloMs,
    });
    const numberOfLogLinesBefore = connection.logLines.length;

    // Act: a time message arrives.
    connection.latestSocket().simulateMessage({
      type: 'time',
      serverNowMs: serverTimeAtTheHelloMs,
    });

    // Assert: still only the delivery of the hello (so the stage is not rebuilt or
    // touched every ten seconds), and nothing was written to the log.
    expect(connection.deliveries, 'a time message must deliver no slices').toHaveLength(1);
    expect(connection.logLines.length, 'a time message must write no log line').toBe(
      numberOfLogLinesBefore,
    );
  });
});

describe('what gives no sample of the server clock', () => {
  it('leaves a correction already learned exactly as it was after messages without serverNowMs', () => {
    // Arrange: a connection that learned from its hello that it is 2.3 s behind.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: serverTimeAtTheHelloMs,
    });

    // Act: five messages that leave the server's time out arrive: slices and a hello.
    // Read as "the clocks agree" (an offset of zero), five of them would outvote the one
    // real sample and put the time read back on the machine's own clock.
    for (let messageNumber = 1; messageNumber <= 4; messageNumber += 1) {
      connection.latestSocket().simulateMessage({
        type: 'slice',
        name: 'instances',
        slice: [createEnduroClockInstance()],
      });
    }
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
    });

    // Assert: the time read is still the server's; the messages were delivered as always.
    expect(
      readServerAlignedTimeMs(),
      'a message without serverNowMs must never count as an offset of zero',
    ).toBe(serverTimeAtTheHelloMs);
    expect(connection.deliveries, 'all six messages must still deliver their slices').toHaveLength(
      6,
    );
  });

  it('leaves the time read on the clock of the machine after a slice without serverNowMs', () => {
    // Arrange: a connection whose hello left the server's time out, so it has no sample.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
    });

    // Act: a slice message that also leaves it out arrives.
    connection.latestSocket().simulateMessage({
      type: 'slice',
      name: 'instances',
      slice: [createEnduroClockInstance()],
    });

    // Assert: still the machine's own time: nothing was recorded.
    expect(readServerAlignedTimeMs(), 'no serverNowMs, so no correction').toBe(
      serverTimeAtTheHelloMs - renderMachineLagMs,
    );
  });

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
