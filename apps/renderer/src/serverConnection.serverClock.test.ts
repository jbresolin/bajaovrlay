/**
 * The renderer's connection to the server: lining up with the server's clock (apps/renderer)
 *
 * What this module is for:
 *   A race clock on air counts from a moment the server stamped with ITS clock, which
 *   keeps real time from NTP, while the graphic runs on the OBS machine with another
 *   clock. So the connection lines the page up with the server (BAJAOVRLAY-62): at each
 *   `hello` with four clock probes sent one after another, keeping the answer with the
 *   shortest round trip (a page not lined up yet holds the hello's own `serverNowMs`
 *   until then); then one probe per ten-second `time` message, and four again when the
 *   server clock has stepped. Graphics ask readServerAlignedTimeMs() for "now".
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
 *   - A reconnect's hello, late by 400 ms, does not move a page already lined up; its
 *     probes line it up anew 8 h away (the machine slept).
 *   - A `time` message with a new step count of the server clock lines the page up at
 *     once after four probes.
 *
 * What these tests deliberately do not cover:
 *   - What lines nothing up (a slice's time, a commandResult, the state over HTTP) and a
 *     hello without `serverNowMs`; serverConnection.serverClockLinesNothingUp.test.ts.
 *   - The midpoint, the slew and the 2 s rule; packages/shared/src/clock tests.
 *   - The race clock drawing that time; packages/graphics/race-clock's
 *     race-clock.serverClock.test.ts.
 *   - What the connection does with the slices; serverConnection.test.ts.
 */
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { describe, expect, it, vi } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import { createSlicesWithInstances } from './serverConnection.testSupport.js';
import {
  answerEveryClockProbe,
  readClockProbesSent,
  readServerClockNowMs,
  renderMachineLagMs,
  serverTimeAtTheHelloMs,
  startConnectionOnAMachineBehindTheServer,
} from './serverConnectionServerClock.testSupport.js';

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

  it('keeps its time through a reconnect whose hello is 400 ms late', () => {
    // Arrange: a connection lined up at its hello and probes, the enduro clock on air.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: readServerClockNowMs(),
      serverClockStepCount: 0,
    });
    answerEveryClockProbe(connection.latestSocket());

    // Act: the socket drops mid-race and reconnects; the new hello was 400 ms on its way.
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(1_000);
    connection.latestSocket().simulateOpen();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: readServerClockNowMs() - 400,
      serverClockStepCount: 0,
    });
    const timeReadAfterTheHelloMs = readServerAlignedTimeMs();
    answerEveryClockProbe(connection.latestSocket());

    // Assert: the late hello did not set the clock on air back 400 ms (12:38 → 12:37 →
    // 12:38); after the probes, still the server's time.
    expect(timeReadAfterTheHelloMs, 'a late hello must not move a page lined up').toBe(
      readServerClockNowMs() - 4 * 6,
    );
    expect(readServerAlignedTimeMs(), 'the probes agree').toBe(readServerClockNowMs());
  });

  it('lines up anew at a reconnect 8 h away, once its probes answer: the machine slept', () => {
    // Arrange: a connection lined up at its hello and probes.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(),
    });
    answerEveryClockProbe(connection.latestSocket());

    // Act: the machine slept 8 h (its monotonic time stood still); the socket dropped and,
    // reconnected, the new hello and its probes say the server is 8 h further on.
    const eightHoursMs = 8 * 60 * 60 * 1000;
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(1_000);
    connection.latestSocket().simulateOpen();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([]),
      serverNowMs: readServerClockNowMs(renderMachineLagMs + eightHoursMs),
    });
    answerEveryClockProbe(connection.latestSocket(), renderMachineLagMs + eightHoursMs);

    // Assert: on the server's time at once, not 8 h at 0.5% later.
    expect(readServerAlignedTimeMs(), 'a gap of 2 s or more is lined up at once').toBe(
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

  it('lines up at once with a step of the server clock that the time message tells', () => {
    // Arrange: a connection lined up at its hello and probes, the server clock never
    // stepped.
    const connection = startConnectionOnAMachineBehindTheServer();
    connection.latestSocket().simulateMessage({
      type: 'hello',
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      serverNowMs: readServerClockNowMs(),
      serverClockStepCount: 0,
    });
    const probesAnsweredAtTheHello = answerEveryClockProbe(connection.latestSocket());

    // Act: the server clock steps 1.5 s forwards ("Acertar relógio agora"); the server
    // sends a time message at once with the new count; the page's probes are answered.
    const lagAfterTheStepMs = renderMachineLagMs + 1_500;
    connection.latestSocket().simulateMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(lagAfterTheStepMs),
      serverClockStepCount: 1,
    });
    const probesAnsweredInAll = answerEveryClockProbe(
      connection.latestSocket(),
      lagAfterTheStepMs,
      probesAnsweredAtTheHello,
    );

    // Assert: four probes after the step, and the page on the server's new time at once.
    expect(probesAnsweredInAll - probesAnsweredAtTheHello, 'four probes, as at a hello').toBe(4);
    expect(readServerAlignedTimeMs(), 'a race clock on air follows the step at once').toBe(
      readServerClockNowMs(lagAfterTheStepMs),
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
