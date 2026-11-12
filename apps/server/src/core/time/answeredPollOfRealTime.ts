import type { ServerClockLastAnswer } from '@bajaovrlay/shared';

import type { HttpDatePollOutcome } from './httpDateClient.js';
import type { NtpPollOutcome } from './ntpPolls.js';
import type { RealTimeSample } from './realTimeRate.js';
import type { ServerClock } from './serverClock.js';
import { nameAnNtpServerForTheOperator } from './serverClockSourceFollowed.js';
import type { LastNtpAnswer } from './serverClockStatus.js';

/** An answered poll of either source: NTP's and HTTPS's answers have the same fields. */
export type AnsweredPoll =
  | Extract<NtpPollOutcome, { isAnswered: true }>
  | Extract<HttpDatePollOutcome, { isAnswered: true }>;

/** One answer, as the discipline weighs it and as it is reported. */
export type AnswerTaken = {
  /** Real time minus the server clock when the answer arrived, in ms (not rounded). */
  differenceMs: number;
  /** The answer as the rate's window takes it. */
  sample: RealTimeSample;
  /** As the poll named it (NTP's `host:port`), for a confirmation's server to ask last. */
  serverName: string;
  source: ServerClockLastAnswer['source'];
  /** As "Verificar servidor" and the header's menu say it. */
  lastAnswer: ServerClockLastAnswer;
  /** As /health's lastNtpAnswer says it; undefined for an HTTPS answer. */
  lastNtpAnswer: LastNtpAnswer | undefined;
};

/**
 * Reads an answered poll against the server clock (BAJAOVRLAY-62, both sources since
 * BAJAOVRLAY-76): real time when it arrived is its local arrival plus its offset, and the
 * difference is that minus what the server clock read at the same monotonic moment.
 */
export function readAnAnsweredPoll(
  outcome: AnsweredPoll,
  source: ServerClockLastAnswer['source'],
  serverClock: ServerClock,
): AnswerTaken {
  const { answer, serverName } = outcome;
  const realTimeAtArrivalMs = answer.localTimeAtArrivalMs + answer.offsetMs;
  const serverTimeAtArrivalMs = serverClock.readServerTimeAtMonotonicMs(
    answer.localTimeAtArrivalMs,
  );
  const differenceMs = realTimeAtArrivalMs - serverTimeAtArrivalMs;
  const atMs = Math.round(realTimeAtArrivalMs);
  const roundedDifferenceMs = Math.round(differenceMs);
  const lastNtpAnswer: LastNtpAnswer | undefined =
    source === 'ntp'
      ? {
          serverName,
          atMs,
          differenceMs: roundedDifferenceMs,
          roundTripMs: Math.round(answer.roundTripMs),
        }
      : undefined;
  const nameForTheOperator =
    source === 'ntp' ? nameAnNtpServerForTheOperator(serverName) : serverName;
  return {
    differenceMs,
    sample: {
      localTimeMs: answer.localTimeAtArrivalMs,
      realTimeMs: realTimeAtArrivalMs,
      roundTripMs: answer.roundTripMs,
    },
    serverName,
    source,
    lastAnswer: {
      source,
      serverName: nameForTheOperator,
      atMs,
      differenceMs: roundedDifferenceMs,
    },
    lastNtpAnswer,
  };
}
