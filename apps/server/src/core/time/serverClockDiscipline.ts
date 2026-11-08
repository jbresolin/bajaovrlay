import type { ServerLogger } from '../logger/createLogger.js';
import type { NtpPollOutcome } from './ntpPolls.js';
import {
  estimateRateOfRealTime,
  keepTheAnswersOfTheRateWindow,
  type RealTimeSample,
} from './realTimeRate.js';
import type { ServerClock } from './serverClock.js';

/** How often NTP is polled, as ntpd and timesyncd start: every 64 s. */
export const ntpPollIntervalMs = 64_000;

/** From this difference on, the offset is stepped (when nothing on air counts time). */
export const bigDifferenceMs = 1_000;

/** How long the boot waits for NTP before it starts on the machine's wall clock. */
export const bootWaitForNtpMs = 3_000;

/** The last NTP answer, as "Verificar servidor" shows it. */
export type LastNtpAnswer = {
  serverName: string;
  /** Real time when the answer arrived, in whole ms since 1970. */
  atMs: number;
  /** Real time minus the server clock at that moment, in whole ms. */
  differenceMs: number;
  roundTripMs: number;
};

/** What the discipline reports: the last answer, what is left to cover, the rate in use. */
export type ServerClockStatus = {
  /** Undefined until NTP has answered once. */
  lastNtpAnswer: LastNtpAnswer | undefined;
  /**
   * Real time minus the server clock now, as far as NTP said: the slew still to cover,
   * in whole ms; positive when the server clock is behind. Undefined until NTP answered.
   * The header warns from 2 s on.
   */
  offFromRealTimeMs: number | undefined;
  rate: number;
};

/** What "Acertar relógio agora" did: stepped by how much, or why it could not. */
export type SetToRealTimeOutcome =
  | { isSet: true; steppedByMs: number }
  | { isSet: false; reason: 'noAnswer'; problems: string[] }
  | { isSet: false; reason: 'ntpOff' };

/** The running discipline of the server clock. */
export type ServerClockDiscipline = {
  /** The boot's first correction: a step, waiting up to 3 s for NTP. Never rejects. */
  stepToRealTimeAtBoot: () => Promise<void>;
  /** "Acertar relógio agora": asks NTP now and steps, whatever is on air. */
  setToRealTimeNow: (actor: string) => Promise<SetToRealTimeOutcome>;
  readStatus: () => ServerClockStatus;
  /** Stops polling; may be called more than once. */
  stop: () => void;
};

/** What the discipline needs: the clock it corrects, how to poll, what is on air, a logger. */
export type ServerClockDisciplineOptions = {
  serverClock: ServerClock;
  /** One poll of the NTP servers (ntpPolls.ts), measured against the clock's monotonic time. */
  pollForRealTime: () => Promise<NtpPollOutcome>;
  /** Whether a running clock or a count to a moment is on program or preview now. */
  isAnythingCountingTimeOnAir: () => boolean;
  logger: ServerLogger;
};

/**
 * Keeps the server clock on real time from NTP (BAJAOVRLAY-62). Every 64 s it polls NTP;
 * each answer corrects two things apart:
 * - the rate: from the answers of the last eight minutes (realTimeRate.ts), applied at
 *   once, up to ±10%; a jump between answers (a sleep) restarts the window instead;
 * - the offset (real time minus the server clock):
 *   - under 1 s: slewed, at most 0.5% of the time passing (serverClock.ts);
 *   - 1 s or more: slewed for now, and NTP is polled again at once to confirm it. When the
 *     second poll confirms it, the clock steps, unless something on program or preview
 *     counts time (timeCountedOnAnOutput.ts); then it keeps slewing, and the header warns
 *     from 2 s on, until "Acertar relógio agora" or the next poll with nothing counting.
 * Without NTP the clock runs on at its last rate; the outage is warned once. A schedule
 * moment skipped by a forward step is dropped, not fired late (triggers' 5 s window).
 */
export function startServerClockDiscipline(
  options: ServerClockDisciplineOptions,
): ServerClockDiscipline {
  const { serverClock, pollForRealTime, isAnythingCountingTimeOnAir, logger } = options;
  let answersOfTheRateWindow: RealTimeSample[] = [];
  let lastNtpAnswer: LastNtpAnswer | undefined;
  let isABigDifferenceWaitingForConfirmation = false;
  // True at the start, so that a boot without NTP is warned by the boot itself only.
  let didNtpAnswerTheLastPoll = true;
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  /** Records an answer (the rate, the last answer) and returns the difference it found. */
  function takeInTheAnswer(outcome: Extract<NtpPollOutcome, { isAnswered: true }>): number {
    const { answer, serverName } = outcome;
    const realTimeAtArrivalMs = answer.localTimeAtArrivalMs + answer.offsetMs;
    const serverTimeAtArrivalMs = serverClock.readServerTimeAtMonotonicMs(
      answer.localTimeAtArrivalMs,
    );
    const differenceMs = realTimeAtArrivalMs - serverTimeAtArrivalMs;
    lastNtpAnswer = {
      serverName,
      atMs: Math.round(realTimeAtArrivalMs),
      differenceMs: Math.round(differenceMs),
      roundTripMs: Math.round(answer.roundTripMs),
    };
    correctTheRate({
      localTimeMs: answer.localTimeAtArrivalMs,
      realTimeMs: realTimeAtArrivalMs,
      roundTripMs: answer.roundTripMs,
    });
    return differenceMs;
  }

  /** Adds an answer to the rate's window and runs the clock at the new estimate, if any. */
  function correctTheRate(newestAnswer: RealTimeSample): void {
    answersOfTheRateWindow = keepTheAnswersOfTheRateWindow(answersOfTheRateWindow, newestAnswer);
    const estimate = estimateRateOfRealTime(answersOfTheRateWindow);
    if (estimate.kind === 'implausible') {
      // Real time jumped between two answers (the machine slept, or the NTP server was
      // reset): no clock runs like that, so the window starts again from this answer and
      // the rate in use stays. The offset rules below deal with the jump itself.
      logger.info(
        { measured_rate: estimate.rate },
        'server clock rate window restarted: real time jumped between two NTP answers',
      );
      answersOfTheRateWindow = [newestAnswer];
      return;
    }
    if (estimate.kind === 'estimated') {
      serverClock.runAtRate(estimate.rate);
    }
  }

  /** Applies the offset rules; true when a second poll must confirm a big difference now. */
  function correctTheDifference(differenceMs: number): boolean {
    const roundedDifferenceMs = Math.round(differenceMs);
    if (Math.abs(differenceMs) < bigDifferenceMs) {
      isABigDifferenceWaitingForConfirmation = false;
      serverClock.slewBy(differenceMs);
      return false;
    }
    if (!isABigDifferenceWaitingForConfirmation) {
      isABigDifferenceWaitingForConfirmation = true;
      serverClock.slewBy(differenceMs);
      logger.warn(
        { difference_ms: roundedDifferenceMs },
        'server clock is 1 s or more off real time; asking NTP again to confirm',
      );
      return true;
    }
    isABigDifferenceWaitingForConfirmation = false;
    if (!isAnythingCountingTimeOnAir()) {
      serverClock.stepBy(differenceMs);
      logger.warn({ difference_ms: roundedDifferenceMs }, 'server clock stepped to real time');
      return false;
    }
    serverClock.slewBy(differenceMs);
    logger.warn(
      { difference_ms: roundedDifferenceMs },
      'server clock not stepped: something on air counts time, so it is slewed at 0.5%',
    );
    return false;
  }

  /** Remembers whether NTP answered; warns when it stops, and says when it is back. */
  function noteWhetherNtpAnswered(outcome: NtpPollOutcome): void {
    if (!outcome.isAnswered && didNtpAnswerTheLastPoll) {
      logger.warn(
        { problems: outcome.problems },
        'NTP gave no answer; the server clock runs on at its last rate',
      );
    }
    if (outcome.isAnswered && !didNtpAnswerTheLastPoll) {
      logger.info({ ntp_server: outcome.serverName }, 'NTP answers again');
    }
    didNtpAnswerTheLastPoll = outcome.isAnswered;
  }

  async function pollAndCorrect(): Promise<void> {
    const outcome = await pollForRealTime();
    if (isStopped) {
      return;
    }
    noteWhetherNtpAnswered(outcome);
    if (!outcome.isAnswered) {
      scheduleTheNextPoll(ntpPollIntervalMs);
      return;
    }
    const differenceMs = takeInTheAnswer(outcome);
    const isAConfirmationNeeded = correctTheDifference(differenceMs);
    scheduleTheNextPoll(isAConfirmationNeeded ? 0 : ntpPollIntervalMs);
  }

  function scheduleTheNextPoll(waitMs: number): void {
    if (isStopped) {
      return;
    }
    nextPollTimer = setTimeout(() => void pollAndCorrect(), waitMs);
    // The polls alone must never keep the process alive.
    nextPollTimer.unref();
  }

  async function stepToRealTimeAtBoot(): Promise<void> {
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    const noAnswerInTime = new Promise<undefined>((resolve) => {
      waitTimer = setTimeout(() => resolve(undefined), bootWaitForNtpMs);
    });
    const outcome = await Promise.race([pollForRealTime(), noAnswerInTime]);
    clearTimeout(waitTimer);
    if (outcome === undefined || !outcome.isAnswered) {
      didNtpAnswerTheLastPoll = false;
      logger.warn(
        { problems: outcome?.problems ?? ['no answer within 3 s'] },
        "server clock starts on the machine's wall clock: NTP gave no answer at boot",
      );
      return;
    }
    const differenceMs = takeInTheAnswer(outcome);
    serverClock.stepBy(differenceMs);
    logger.info(
      { difference_ms: Math.round(differenceMs), ntp_server: outcome.serverName },
      'server clock set to real time from NTP at boot',
    );
  }

  async function setToRealTimeNow(actor: string): Promise<SetToRealTimeOutcome> {
    const outcome = await pollForRealTime();
    if (!outcome.isAnswered) {
      logger.warn(
        { problems: outcome.problems, actor },
        'server clock not set: NTP gave no answer',
      );
      return { isSet: false, reason: 'noAnswer', problems: outcome.problems };
    }
    const differenceMs = takeInTheAnswer(outcome);
    serverClock.stepBy(differenceMs);
    isABigDifferenceWaitingForConfirmation = false;
    logger.warn(
      { difference_ms: Math.round(differenceMs), actor },
      'server clock set to real time by hand ("Acertar relógio agora")',
    );
    return { isSet: true, steppedByMs: Math.round(differenceMs) };
  }

  scheduleTheNextPoll(ntpPollIntervalMs);

  return {
    stepToRealTimeAtBoot,
    setToRealTimeNow,
    readStatus: () => ({
      lastNtpAnswer,
      offFromRealTimeMs: lastNtpAnswer === undefined ? undefined : serverClock.readSlewLeftMs(),
      rate: serverClock.readRate(),
    }),
    stop: () => {
      isStopped = true;
      clearTimeout(nextPollTimer);
    },
  };
}
