import type { ServerMessage } from '@bajaovrlay/shared';
import {
  recordClockProbeAnswer,
  startLiningUpAgainIfTheServerClockStepped,
} from '@bajaovrlay/shared/clock';

import type { ServerStateStore } from './serverStateStore';

/** The server's ten-second `time` message, as the protocol describes it. */
type ServerTimeMessage = Extract<ServerMessage, { type: 'time' }>;

/** The server's answer to one of this page's clock probes. */
type ClockProbeAnswerMessage = Extract<ServerMessage, { type: 'clockProbeAnswer' }>;

/**
 * Takes in the server's `time` message (sent every ten seconds, and at once after a step of
 * its clock, whose new step count starts four probes that line up at once). How far the
 * server clock is off real time goes to the store, which only changes (and redraws the
 * header) when the whole seconds change; so do what the clock follows and whether it is
 * without sync (BAJAOVRLAY-76). No log line. The caller sends one probe afterwards, which
 * keeps the alignment fresh.
 */
export function takeInTheServerTimeMessage(
  message: ServerTimeMessage,
  serverStateStore: ServerStateStore,
): void {
  startLiningUpAgainIfTheServerClockStepped(message.serverClockStepCount);
  serverStateStore.getState().noteServerClockOffRealTime(message.offFromRealTimeMs);
  serverStateStore
    .getState()
    .noteServerClockSource(message.serverClockSource, message.isServerClockWithoutSync);
}

/**
 * Records the answer to one clock probe (packages/shared/src/clock/serverAlignedTime.ts)
 * and says whether another probe is needed: after a hello the page asks four in a row.
 * `localTimeAtArrivalMs` is read as the message arrives, before it is checked, so the
 * sample is not made later by the check.
 */
export function takeInAClockProbeAnswer(
  message: ClockProbeAnswerMessage,
  localTimeAtArrivalMs: number,
): { isAnotherProbeNeeded: boolean } {
  return recordClockProbeAnswer({
    pageSentAtMs: message.pageSentAtMs,
    serverNowMs: message.serverNowMs,
    pageReceivedAtMs: localTimeAtArrivalMs,
  });
}
