/**
 * The renderer's connection to the server: lining up with the server's clock (apps/renderer)
 *
 * What this module is for:
 *   A race clock on air counts from a moment the server stamped with ITS clock, which
 *   keeps real time from NTP, while the graphic runs on the OBS machine with another
 *   clock. So the connection lines the page up with the server (BAJAOVRLAY-62): at each
 *   `hello` at once with the hello's own `serverNowMs`, then with four clock probes sent
 *   one after another, keeping the answer with the shortest round trip; then one probe
 *   per ten-second `time` message. Graphics ask readServerAlignedTimeMs() for "now".
 *
 * What these tests prove (the machine's clock faked 2.3 s behind the server's; a stand-in
 *   server answers each probe after a round trip the test chooses):
 *   - Before any message the shared "now" is the machine's own time.
 *   - After the hello it is the server's at once, and the hello is delivered as always.
 *   - The hello is followed by four probes, one after another, and no fifth.
 *   - A `time` message sends one probe and does nothing else: no delivery, no log line.
 *   - Through a quiet minute in which the machine's wall clock steps back 5 s, the time
 *     read stays on the server's clock (monotonic time between answers).
 *   - A program monitor lines up the same way.
 *   - The time a `slice` carries no longer moves the time read: only the hello and the
 *     probes do.
 *   - A hello without `serverNowMs`, a `commandResult` and the state read over HTTP line
 *     nothing up; a probe answered after such a hello does.
 *   - A new hello (after a reconnect) lines up afresh, even 8 h away (the machine slept).
 *
 * What these tests deliberately do not cover:
 *   - The midpoint, the slew and the 2 s rule; packages/shared/src/clock tests.
 *   - The race clock drawing that time; packages/graphics/race-clock's
 *     race-clock.serverClock.test.ts.
 *   - What the connection does with the slices; serverConnection.test.ts.
 */
import { forgetTheServerClockAlignment, readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import {
  createSlicesWithInstances,
  createStateReadAnsweredByHand,
  type FakeServerSocket,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock. */
const serverTimeAtTheHelloMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
const renderMachineLagMs = 2_300;

/**
 * Starts a connection whose socket has just opened, on a machine whose clock is 2.3 s
 * behind the server's. The alignment is forgotten before and after, so no test sees
 * another one's.
 */
function startConnectionOnAMachineBehindTheServer(
  readStateOverHttp?: (address: string) => Promise<unknown>,
) {
  const connection = startConnectionForTests(readStateOverHttp);
  forgetTheServerClockAlignment();
  onTestFinished(() => forgetTheServerClockAlignment());
  vi.setSystemTime(serverTimeAtTheHelloMs - renderMachineLagMs);
  connection.latestSocket().simulateOpen();
  return connection;
}

/** The monotonic time of the machine, in whole ms, as the page reads it. */
function readMonotonicTimeOfTheMachineMs(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}

/** What the server's clock shows now: the machine's monotonic time plus how far it lags. */
function readServerClockNowMs(lagOfThisMachineMs: number = renderMachineLagMs): number {
  return readMonotonicTimeOfTheMachineMs() + lagOfThisMachineMs;
}

/** The clock probes the page has sent on a socket, in order. */
function readClockProbesSent(socket: FakeServerSocket): { pageSentAtMs: number }[] {
  return socket.textsSentByTheRenderer
    .map((text) => JSON.parse(text) as { type: string; pageSentAtMs: number })
    .filter((message) => message.type === 'clockProbe');
}

/**
 * Answers, as the server would, every probe not yet answered: each answer arrives 6 ms
 * after its probe, read by the server halfway. Answering one may make the page send
 * another, which is answered in turn. Returns how many were answered.
 */
function answerEveryClockProbe(
  socket: FakeServerSocket,
  lagOfThisMachineMs = renderMachineLagMs,
): number {
  let probesAnswered = 0;
  while (readClockProbesSent(socket).length > probesAnswered) {
    const probe = readClockProbesSent(socket)[probesAnswered];
    if (probe === undefined) {
      break;
    }
    vi.advanceTimersByTime(6);
    socket.simulateMessage({
      type: 'clockProbeAnswer',
      pageSentAtMs: probe.pageSentAtMs,
      serverNowMs: probe.pageSentAtMs + 3 + lagOfThisMachineMs,
    });
    probesAnswered += 1;
  }
  return probesAnswered;
}

describe('lining up with the server clock at the hello', () => {
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

  it("is the server's time at once after the hello, on a machine 2.3 s behind", () => {
    // Arrange: a connection on the machine that is 2.3 s behind.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the server greets, saying its clock shows 14:32:05.
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: serverTimeAtTheHelloMs,
    });
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: 14:32:05, not the machine's 14:32:02.700; and the hello was delivered.
    expect(timeReadMs, 'after the hello the shared now must be the server time').toBe(
      serverTimeAtTheHelloMs,
    );
    expect(connection.deliveries, 'the hello must still deliver its slices').toHaveLength(1);
  });

  it('sends four probes after the hello, one after another, and no fifth', () => {
    // Arrange: a connection that got its hello, 40 ms late (one-way).
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs() - 40,
    });
    const probesRightAfterTheHello = readClockProbesSent(connection.latestSocket()).length;

    // Act: the server answers each probe as it comes.
    const probesAnswered = answerEveryClockProbe(connection.latestSocket());

    // Assert: one probe at the hello, four in all; the page reads the server's time exactly.
    expect(probesRightAfterTheHello, 'the first probe goes with the hello').toBe(1);
    expect(probesAnswered, 'four probes after a hello, no more').toBe(4);
    expect(readServerAlignedTimeMs(), 'the probes correct the late hello').toBe(
      readServerClockNowMs(),
    );
  });

  it('lines a program monitor up the same way', () => {
    // Arrange: the copy of the renderer page the control page frames, which runs this
    // very code and differs only in the address it dials.
    const connection = startConnectionOnAMachineBehindTheServer();

    // Act: the monitor's hello arrives, and its probes are answered.
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: serverTimeAtTheHelloMs,
    });
    answerEveryClockProbe(connection.latestSocket());

    // Assert: the server's time there too.
    expect(readServerAlignedTimeMs(), 'a monitor must read the server time as well').toBe(
      readServerClockNowMs(),
    );
  });

  it('lines up afresh at a new hello, even 8 h away after the machine slept', () => {
    // Arrange: a connection lined up at its hello and probes.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(),
    });
    answerEveryClockProbe(connection.latestSocket());

    // Act: the machine slept 8 h (its monotonic time stood still); the socket dropped and,
    // reconnected, the new hello says the server is 8 h further on.
    const eightHoursMs = 8 * 60 * 60 * 1000;
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(1_000);
    connection.latestSocket().simulateOpen();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(renderMachineLagMs + eightHoursMs),
    });

    // Assert: on the server's time at once.
    expect(readServerAlignedTimeMs(), 'a new hello drops what was lined up before').toBe(
      readServerClockNowMs(renderMachineLagMs + eightHoursMs),
    );
  });
});

describe('the time message the server sends every ten seconds', () => {
  it('sends one probe and does nothing else: no delivery and no log line', () => {
    // Arrange: a connection lined up at its hello, and how many log lines it has written.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: serverTimeAtTheHelloMs,
    });
    answerEveryClockProbe(connection.latestSocket());
    const probesBefore = readClockProbesSent(connection.latestSocket()).length;
    const numberOfLogLinesBefore = connection.logLines.length;

    // Act: a time message arrives.
    connection
      .latestSocket()
      .simulateMessage({ type: 'time', serverNowMs: readServerClockNowMs() });

    // Assert: one more probe; still only the delivery of the hello (so the stage is not
    // touched every ten seconds), and nothing was written to the log.
    expect(
      readClockProbesSent(connection.latestSocket()).length,
      'one probe per time message',
    ).toBe(probesBefore + 1);
    expect(connection.deliveries, 'a time message must deliver no slices').toHaveLength(1);
    expect(connection.logLines.length, 'a time message must write no log line').toBe(
      numberOfLogLinesBefore,
    );
  });

  it('keeps the time read on the server clock through a quiet minute with a step of the wall clock', () => {
    // Arrange: a connection lined up at its hello; then nothing changes on the server.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: readServerClockNowMs(),
    });
    answerEveryClockProbe(connection.latestSocket());
    const serverTimeLinedUpMs = readServerClockNowMs();

    // Act: twenty seconds in, a time sync moves this machine's wall clock 5 s back; the
    // time is read right after the step; time messages come every ten seconds until the
    // minute is over, and their probes are answered.
    let timeReadRightAfterTheStepMs = 0;
    let probesAnsweredSoFar = 4;
    for (let secondsSinceTheHello = 10; secondsSinceTheHello <= 60; secondsSinceTheHello += 10) {
      vi.advanceTimersByTime(10_000);
      if (secondsSinceTheHello === 20) {
        vi.setSystemTime(Date.now() - 5_000);
        timeReadRightAfterTheStepMs = readServerAlignedTimeMs();
      }
      connection
        .latestSocket()
        .simulateMessage({ type: 'time', serverNowMs: readServerClockNowMs() });
      const probe = readClockProbesSent(connection.latestSocket())[probesAnsweredSoFar];
      if (probe !== undefined) {
        connection.latestSocket().simulateMessage({
          type: 'clockProbeAnswer',
          pageSentAtMs: probe.pageSentAtMs,
          serverNowMs: probe.pageSentAtMs + renderMachineLagMs,
        });
        probesAnsweredSoFar += 1;
      }
    }

    // Assert: the step never showed, right after it nor a minute after the hello.
    expect(
      timeReadRightAfterTheStepMs,
      'a step of the wall clock must not move the time read',
    ).toBe(serverTimeLinedUpMs + 20_000);
    expect(readServerAlignedTimeMs(), 'a minute on, still the server clock').toBe(
      serverTimeLinedUpMs + 60_000,
    );
  });
});

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
