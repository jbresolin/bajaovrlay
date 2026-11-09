// Test support: the renderer's connection on a machine whose clock is 2.3 s behind the
// server's, and a stand-in server that answers its clock probes. Used by the tests of
// the connection's clock (serverConnection.serverClock*.test.ts); each call forgets the
// page's alignment before and after the test, so no test sees another one's.
import { forgetTheServerClockAlignment } from '@bajaovrlay/shared/clock';
import { onTestFinished, vi } from 'vitest';

import { type FakeServerSocket, startConnectionForTests } from './serverConnection.testSupport.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock. */
export const serverTimeAtTheHelloMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
export const renderMachineLagMs = 2_300;

/**
 * Starts a connection whose socket has just opened, on a machine whose clock is 2.3 s
 * behind the server's. The alignment is forgotten before and after, so no test sees
 * another one's.
 */
export function startConnectionOnAMachineBehindTheServer(
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
export function readServerClockNowMs(lagOfThisMachineMs: number = renderMachineLagMs): number {
  return readMonotonicTimeOfTheMachineMs() + lagOfThisMachineMs;
}

/** The clock probes the page has sent on a socket, in order. */
export function readClockProbesSent(socket: FakeServerSocket): { pageSentAtMs: number }[] {
  return socket.textsSentByTheRenderer
    .map((text) => JSON.parse(text) as { type: string; pageSentAtMs: number })
    .filter((message) => message.type === 'clockProbe');
}

/**
 * Answers, as the server would, every probe after the first `probesAnsweredBefore`: each
 * answer arrives 6 ms after its probe, read by the server halfway. Answering one may make
 * the page send another, which is answered in turn. Returns how many have been answered
 * on the socket in all.
 */
export function answerEveryClockProbe(
  socket: FakeServerSocket,
  lagOfThisMachineMs = renderMachineLagMs,
  probesAnsweredBefore = 0,
): number {
  let probesAnswered = probesAnsweredBefore;
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
