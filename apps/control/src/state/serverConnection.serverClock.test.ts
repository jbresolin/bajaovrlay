/**
 * Server connection: the server's clock (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" shows the time a clock on air shows, worked out on this computer. The
 *   reading on air was stamped with the server's clock, which keeps real time from NTP,
 *   so the page needs "now" on the server's clock too. The connection lines the page up
 *   as the renderer does (BAJAOVRLAY-62): at each hello with four clock probes, keeping
 *   the shortest round trip (a page not lined up yet holds the hello's `serverNowMs` until
 *   then); then one probe per ten-second `time` message, and four again when the server
 *   clock has stepped. The `time` message also says how far the server clock is
 *   off real time, which the header warns about from 2 s on.
 *
 * What these tests prove (this computer's clock faked 2.3 s behind the server's; the test
 *   answers each probe as the server would, 4 ms after it was sent):
 *   - After a hello the shared "now" reads the server's time.
 *   - A hello is followed by four probes, one after another, and no fifth.
 *   - A hello with no time in it lines nothing up; its probes do.
 *   - A `time` message sends one probe, writes no log line, and leaves the store alone
 *     while the server clock is on real time; one with a new step count of the server
 *     clock lines the page up at once after four probes.
 *   - A `time` message saying the server clock is 2.35 s behind real time puts 2 s in the
 *     store for the header; the same whole seconds again change nothing; under 2 s clears it.
 *
 * What these tests deliberately do not cover:
 *   - The midpoint, the slew and the 2 s rule of the alignment; packages/shared/src/clock.
 *   - The header's warning itself; features/serverClock.
 */
import { forgetTheServerClockAlignment, readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectControlPageToFakeServer } from './connectionToFakeServer.testSupport';
import type { FakeServerSocket } from './fakeServerSocket.testSupport';
import { buildSlicesWithTheRaceClockOnAir } from './slicesLikeTheServerSends.testSupport';

const momentTheClockWentOnAir = '2026-10-12T13:00:00.000Z';
// 10:15 in Brasília on the server, while this computer's clock reads 2.3 seconds earlier.
const serverTimeMs = Date.parse('2026-10-12T13:15:00.000Z');
const thisComputersTimeMs = serverTimeMs - 2_300;

afterEach(() => {
  // The alignment lives outside the test (on the page's global object, shared with
  // graphics), so each test hands the next one a clock that has heard nothing.
  forgetTheServerClockAlignment();
  vi.useRealTimers();
});

/** What the server's clock reads now: this computer's monotonic time plus how far it lags. */
function readServerClockNowMs(lagOfThisComputerMs = 2_300): number {
  return Math.floor(performance.timeOrigin + performance.now()) + lagOfThisComputerMs;
}

/**
 * Answers, as the server would, every probe after the first `probesAnsweredBefore`: 4 ms
 * after the probe, read by the server halfway. An answer may make the page send another,
 * answered in turn. Returns how many have been answered in all.
 */
function answerEveryClockProbe(
  fakeServerSocket: FakeServerSocket,
  lagOfThisComputerMs = 2_300,
  probesAnsweredBefore = 0,
): number {
  let probesAnswered = probesAnsweredBefore;
  while (fakeServerSocket.listClockProbesReceived().length > probesAnswered) {
    const probe = fakeServerSocket.listClockProbesReceived()[probesAnswered];
    if (probe === undefined) {
      break;
    }
    vi.advanceTimersByTime(4);
    fakeServerSocket.sendMessage({
      type: 'clockProbeAnswer',
      pageSentAtMs: probe.pageSentAtMs,
      serverNowMs: probe.pageSentAtMs + 2 + lagOfThisComputerMs,
    });
    probesAnswered += 1;
  }
  return probesAnswered;
}

/** A control page on this computer, connected, whose server said hello (with or without time). */
function connectAfterAHello(options: { isTheTimeInTheHello: boolean }) {
  vi.useFakeTimers();
  vi.setSystemTime(thisComputersTimeMs);
  const controlPage = connectControlPageToFakeServer();
  controlPage.fakeServerSocket.acceptConnection();
  controlPage.fakeServerSocket.sendMessage({
    type: 'hello',
    slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    ...(options.isTheTimeInTheHello ? { serverNowMs: serverTimeMs, serverClockStepCount: 0 } : {}),
  });
  return controlPage;
}

describe('the control page lining up with the server clock', () => {
  it('reads the time of the server after a hello, on a computer 2.3 s behind', () => {
    // Arrange: this computer's clock held 2.3 seconds behind the server's.

    // Act: the server says hello, stamped with its time.
    connectAfterAHello({ isTheTimeInTheHello: true });

    // Assert: "now" for the page is the server's time, not this computer's.
    expect(
      readServerAlignedTimeMs(),
      'the shared clock must read the time of the server, 2.3 seconds ahead of this computer',
    ).toBe(serverTimeMs);
  });

  it('sends four probes after the hello, one after another, and no fifth', () => {
    // Arrange: a page that got its hello.
    const { fakeServerSocket } = connectAfterAHello({ isTheTimeInTheHello: true });

    // Act: the server answers each probe as it comes.
    const probesAnswered = answerEveryClockProbe(fakeServerSocket);

    // Assert: four, and the page on the server's time.
    expect(probesAnswered, 'four probes after a hello, no more').toBe(4);
    expect(readServerAlignedTimeMs(), 'the page reads the server clock').toBe(
      readServerClockNowMs(),
    );
  });

  it('lines up from its probes when the hello carried no time', () => {
    // Arrange: a hello with no time in it, as a server from before this field would send.
    const { fakeServerSocket } = connectAfterAHello({ isTheTimeInTheHello: false });
    const timeReadBeforeTheProbesMs = readServerAlignedTimeMs();

    // Act: the probes are answered.
    answerEveryClockProbe(fakeServerSocket);

    // Assert: this computer's own clock until then; the server's after.
    expect(timeReadBeforeTheProbesMs, "with nothing to go by, this computer's clock").toBe(
      thisComputersTimeMs,
    );
    expect(readServerAlignedTimeMs(), 'the probes line the page up').toBe(readServerClockNowMs());
  });
});

describe('the time message the server sends every ten seconds', () => {
  it('sends one probe, writes no log line and leaves the store alone while the clock is right', () => {
    // Arrange: a page lined up, and what its store and its log hold at this point.
    const { fakeServerSocket, serverStateStore, recordedLogLines } = connectAfterAHello({
      isTheTimeInTheHello: true,
    });
    answerEveryClockProbe(fakeServerSocket);
    const storeStateBefore = serverStateStore.getState();
    const numberOfLogLinesBefore = recordedLogLines.length;

    // Act: a time message arrives; the server clock is 12 ms off real time.
    fakeServerSocket.sendMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(),
      offFromRealTimeMs: 12,
    });

    // Assert: a fifth probe; the very same store state (nothing redraws every ten
    // seconds); no new log line.
    expect(fakeServerSocket.listClockProbesReceived(), 'one probe per time message').toHaveLength(
      5,
    );
    expect(serverStateStore.getState(), 'a time message must not touch the store').toBe(
      storeStateBefore,
    );
    expect(recordedLogLines.length, 'a time message must write no log line').toBe(
      numberOfLogLinesBefore,
    );
  });

  it('lines up at once with a step of the server clock that it tells', () => {
    // Arrange: a page lined up; the server clock has never stepped.
    const { fakeServerSocket } = connectAfterAHello({ isTheTimeInTheHello: true });
    const probesAnsweredAtTheHello = answerEveryClockProbe(fakeServerSocket);

    // Act: the server clock steps 1.5 s forwards ("Acertar relógio agora"); the server
    // sends a time message at once with the new step count; the probes are answered.
    const lagAfterTheStepMs = 2_300 + 1_500;
    fakeServerSocket.sendMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(lagAfterTheStepMs),
      serverClockStepCount: 1,
    });
    const probesAnsweredInAll = answerEveryClockProbe(
      fakeServerSocket,
      lagAfterTheStepMs,
      probesAnsweredAtTheHello,
    );

    // Assert: four probes after the step, and "Edição rápida" on the new time at once.
    expect(probesAnsweredInAll - probesAnsweredAtTheHello, 'four probes, as at a hello').toBe(4);
    expect(readServerAlignedTimeMs(), 'the page follows the step at once').toBe(
      readServerClockNowMs(lagAfterTheStepMs),
    );
  });

  it('keeps the whole seconds the server clock is off real time, from 2 s on, for the header', () => {
    // Arrange: a page lined up.
    const { fakeServerSocket, serverStateStore } = connectAfterAHello({
      isTheTimeInTheHello: true,
    });
    answerEveryClockProbe(fakeServerSocket);

    // Act: the server clock is held 2.35 s behind real time (a clock runs on air); ten
    // seconds later 2.30 s; later NTP is back within 1.5 s.
    fakeServerSocket.sendMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(),
      offFromRealTimeMs: 2_350,
    });
    const stateAt2350Ms = serverStateStore.getState();
    fakeServerSocket.sendMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(),
      offFromRealTimeMs: 2_300,
    });
    const stateAt2300Ms = serverStateStore.getState();
    fakeServerSocket.sendMessage({
      type: 'time',
      serverNowMs: readServerClockNowMs(),
      offFromRealTimeMs: 1_500,
    });

    // Assert: 2 s, the same object for the same 2 s, then nothing to warn about.
    expect(stateAt2350Ms.serverClockSecondsOffRealTime, '2.35 s reads as 2 s').toBe(2);
    expect(stateAt2300Ms, 'the same whole seconds must not redraw the header').toBe(stateAt2350Ms);
    expect(
      serverStateStore.getState().serverClockSecondsOffRealTime,
      'under 2 s there is nothing to warn about',
    ).toBeNull();
  });
});
