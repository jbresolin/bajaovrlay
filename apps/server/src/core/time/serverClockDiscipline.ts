import type { ServerLogger } from '../logger/createLogger.js';
import { type NtpPollOutcome, type NtpPollRequest, questionsPerPoll } from './ntpPolls.js';
import {
  estimateRateOfRealTime,
  findTheLongestRoundTripKeptMs,
  keepTheAnswersOfTheRateWindow,
  type RealTimeSample,
} from './realTimeRate.js';
import type { ServerClock } from './serverClock.js';
import {
  findTheNextPollIntervalMs,
  intervalBeforeAConfirmationMs,
  slowDownAfterARateKiss,
} from './serverClockPollIntervals.js';

/** From this difference on, the offset is stepped (when nothing on air counts time). */
export const bigDifferenceMs = 1_000;

/**
 * Past this difference from the server clock, NTP's time is not taken on its own: a
 * track-side NTP box without its GPS fix may tell a time years away. At boot the server
 * clock is the machine's wall clock, so a machine with a dead clock battery waits for
 * "Acertar relógio agora" too; the header warns.
 */
export const largestDifferenceTakenOnItsOwnMs = 24 * 60 * 60 * 1000;

/** How long the boot waits for NTP before it starts on the machine's wall clock. */
export const bootWaitForNtpMs = 3_000;

/** A new rate is ramped to over this much monotonic time, not taken at once. */
export const rampToANewRateMs = 60_000;

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
   * Real time minus the server clock now, as far as NTP said: the slew still to cover, or
   * a difference over 24 h not taken, in whole ms; positive when the server clock is
   * behind. Undefined until NTP answered. The header warns from 2 s on.
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
  pollForRealTime: (request: NtpPollRequest) => Promise<NtpPollOutcome>;
  /** Whether a step by this much would make anything on program or preview jump. */
  isAnythingCountingTimeOnAir: (stepByMs: number) => boolean;
  /** Called after each step, so every page lines up again at once. */
  afterEachStep?: (() => void) | undefined;
  logger: ServerLogger;
};

/** Where a big difference (1 s or more) stands. */
type BigDifferenceState = 'none' | 'waitingForConfirmation' | 'heldWhileTimeCountsOnAir';

/** A poll that asks one question: the boot, and "Acertar relógio agora", where someone waits. */
const quickPoll: NtpPollRequest = { questionsPerServer: 1, serverToAskLast: undefined };

/**
 * Keeps the server clock on real time from NTP (BAJAOVRLAY-62). It polls NTP every 16 s
 * until four answers have come, then every 64 s (serverClockPollIntervals.ts); each
 * answer corrects two things apart:
 * - the rate: from the answers of the last eight minutes (realTimeRate.ts), ramped to over
 *   a minute, up to ±10%;
 * - the offset (real time minus the server clock):
 *   - under 1 s: slewed, at most 0.5% of the time passing (serverClock.ts); an answer
 *     whose round trip was an outlier is left aside;
 *   - 1 s or more: slewed for now, and confirmed by a poll 16 s later that asks another
 *     server first. Confirmed, the clock steps, unless the step would make something on
 *     program or preview jump (timeCountedOnAnOutput.ts); then it keeps slewing, the header
 *     warns from 2 s on, and the log says so once, until "Acertar relógio agora" or a poll
 *     with nothing counting. No step on air, however big: the producer decides.
 *   - over 24 h: not taken at all, only reported (largestDifferenceTakenOnItsOwnMs).
 * Without NTP the clock runs on at its last rate; the outage is warned once. A schedule
 * moment skipped by a forward step is dropped, not fired late (triggers' 5 s window).
 */
export function startServerClockDiscipline(
  options: ServerClockDisciplineOptions,
): ServerClockDiscipline {
  const { serverClock, pollForRealTime, isAnythingCountingTimeOnAir, logger } = options;
  let answersOfTheRateWindow: RealTimeSample[] = [];
  let hasARateBeenMeasured = false;
  let answersTaken = 0;
  let lastNtpAnswer: LastNtpAnswer | undefined;
  let bigDifference: BigDifferenceState = 'none';
  let serverOfTheBigDifference: string | undefined;
  // A difference over 24 h not taken, reported for the header while NTP keeps telling it.
  let differenceNotTakenMs: number | undefined;
  let slowDownFactor = 1;
  // True at the start, so that a boot without NTP is warned by the boot itself only.
  let didNtpAnswerTheLastPoll = true;
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  /** One answer, as the discipline weighs it. */
  type AnswerTaken = { differenceMs: number; sample: RealTimeSample; serverName: string };

  /** Reads an answer: the difference it finds, and the sample for the rate. Records it. */
  function readTheAnswer(outcome: Extract<NtpPollOutcome, { isAnswered: true }>): AnswerTaken {
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
    const sample: RealTimeSample = {
      localTimeMs: answer.localTimeAtArrivalMs,
      realTimeMs: realTimeAtArrivalMs,
      roundTripMs: answer.roundTripMs,
    };
    return { differenceMs, sample, serverName };
  }

  /** Adds an answer to the rate's window and ramps to the new estimate, if any. */
  function correctTheRateWith(newestSample: RealTimeSample): void {
    answersOfTheRateWindow = keepTheAnswersOfTheRateWindow(answersOfTheRateWindow, newestSample);
    const estimate = estimateRateOfRealTime(answersOfTheRateWindow);
    if (estimate.kind === 'implausible') {
      // Real time jumped between two answers (the machine slept, or the NTP server was
      // reset): no clock runs like that, so the window starts again from this answer and
      // the rate in use stays. The offset rules deal with the jump itself.
      logger.info(
        { measured_rate: estimate.rate },
        'server clock rate window restarted: real time jumped between two NTP answers',
      );
      answersOfTheRateWindow = [newestSample];
      return;
    }
    if (estimate.kind === 'estimated') {
      hasARateBeenMeasured = true;
      serverClock.rampToRate(estimate.rate, rampToANewRateMs);
    }
  }

  /** Whether an answer's round trip is an outlier among the window's (and its own). */
  function isARoundTripOutlier(sample: RealTimeSample): boolean {
    const longestRoundTripKeptMs = findTheLongestRoundTripKeptMs([
      ...answersOfTheRateWindow,
      sample,
    ]);
    return sample.roundTripMs > longestRoundTripKeptMs;
  }

  function stepTheClockBy(differenceMs: number): void {
    serverClock.stepBy(differenceMs);
    options.afterEachStep?.();
  }

  /** Applies the offset and rate rules to an answer; true when a confirmation must follow. */
  function correctWith(answer: AnswerTaken): boolean {
    const { differenceMs, sample } = answer;
    const roundedDifferenceMs = Math.round(differenceMs);
    if (Math.abs(differenceMs) < bigDifferenceMs) {
      if (bigDifference === 'heldWhileTimeCountsOnAir') {
        logger.info(
          { difference_ms: roundedDifferenceMs },
          'server clock within 1 s of real time again',
        );
      }
      bigDifference = 'none';
      const isAnOutlier = isARoundTripOutlier(sample);
      correctTheRateWith(sample);
      if (!isAnOutlier) {
        serverClock.slewBy(differenceMs);
      }
      return false;
    }
    if (bigDifference === 'none') {
      // Not added to the rate yet: a jump of real time is not a rate, and one answer alone
      // could be a wrong server.
      bigDifference = 'waitingForConfirmation';
      serverOfTheBigDifference = answer.serverName;
      serverClock.slewBy(differenceMs);
      logger.warn(
        { difference_ms: roundedDifferenceMs },
        'server clock is 1 s or more off real time; asking another NTP server in 16 s to confirm',
      );
      return true;
    }
    if (bigDifference === 'waitingForConfirmation' && hasARateBeenMeasured) {
      // Confirmed: real time jumped against monotonic time (a sleep, a server reset). The
      // answers before the jump would read it as a rate, so the window starts again here;
      // the rate in use stays. Before any rate, the difference is the machine's own rate.
      answersOfTheRateWindow = [sample];
    } else {
      correctTheRateWith(sample);
    }
    if (!isAnythingCountingTimeOnAir(differenceMs)) {
      bigDifference = 'none';
      stepTheClockBy(differenceMs);
      logger.warn({ difference_ms: roundedDifferenceMs }, 'server clock stepped to real time');
      return false;
    }
    serverClock.slewBy(differenceMs);
    if (bigDifference !== 'heldWhileTimeCountsOnAir') {
      logger.warn(
        { difference_ms: roundedDifferenceMs },
        'server clock not stepped: something on air counts time, so it is slewed at 0.5% and the header warns',
      );
    }
    bigDifference = 'heldWhileTimeCountsOnAir';
    return false;
  }

  /** Whether a difference is too large to take on its own; warns the first time only. */
  function isNotToBeTakenOnItsOwn(differenceMs: number): boolean {
    if (Math.abs(differenceMs) <= largestDifferenceTakenOnItsOwnMs) {
      differenceNotTakenMs = undefined;
      return false;
    }
    if (differenceNotTakenMs === undefined) {
      logger.warn(
        { difference_ms: Math.round(differenceMs) },
        'NTP time more than 24 h from the server clock not taken; "Acertar relógio agora" takes it',
      );
    }
    differenceNotTakenMs = differenceMs;
    return true;
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

  /** Polls less often after a RATE kiss of death; says so when the interval changes. */
  function noteWhetherNtpAskedToSlowDown(outcome: NtpPollOutcome): void {
    if (!outcome.wasAskedToSlowDown) {
      return;
    }
    const newSlowDownFactor = slowDownAfterARateKiss(slowDownFactor);
    if (newSlowDownFactor !== slowDownFactor) {
      logger.warn(
        { slow_down_factor: newSlowDownFactor },
        'an NTP server asked to be polled less often',
      );
    }
    slowDownFactor = newSlowDownFactor;
  }

  async function pollAndCorrect(request: NtpPollRequest): Promise<void> {
    const outcome = await pollForRealTime(request);
    if (isStopped) {
      return;
    }
    noteWhetherNtpAnswered(outcome);
    noteWhetherNtpAskedToSlowDown(outcome);
    if (!outcome.isAnswered) {
      scheduleARegularPoll();
      return;
    }
    const answer = readTheAnswer(outcome);
    if (isNotToBeTakenOnItsOwn(answer.differenceMs)) {
      scheduleARegularPoll();
      return;
    }
    answersTaken += 1;
    const isAConfirmationNeeded = correctWith(answer);
    if (isAConfirmationNeeded) {
      schedulePoll(intervalBeforeAConfirmationMs, {
        questionsPerServer: questionsPerPoll,
        serverToAskLast: serverOfTheBigDifference,
      });
      return;
    }
    scheduleARegularPoll();
  }

  function scheduleARegularPoll(): void {
    const intervalMs = findTheNextPollIntervalMs({ answersTaken, slowDownFactor });
    schedulePoll(intervalMs, { questionsPerServer: questionsPerPoll, serverToAskLast: undefined });
  }

  function schedulePoll(waitMs: number, request: NtpPollRequest): void {
    if (isStopped) {
      return;
    }
    nextPollTimer = setTimeout(() => void pollAndCorrect(request), waitMs);
    // The polls alone must never keep the process alive.
    nextPollTimer.unref();
  }

  async function stepToRealTimeAtBoot(): Promise<void> {
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    const noAnswerInTime = new Promise<undefined>((resolve) => {
      waitTimer = setTimeout(() => resolve(undefined), bootWaitForNtpMs);
    });
    const outcome = await Promise.race([pollForRealTime(quickPoll), noAnswerInTime]);
    clearTimeout(waitTimer);
    if (outcome === undefined || !outcome.isAnswered) {
      didNtpAnswerTheLastPoll = false;
      logger.warn(
        { problems: outcome?.problems ?? ['no answer within 3 s'] },
        "server clock starts on the machine's wall clock: NTP gave no answer at boot",
      );
      return;
    }
    const answer = readTheAnswer(outcome);
    if (isNotToBeTakenOnItsOwn(answer.differenceMs)) {
      return;
    }
    answersTaken += 1;
    correctTheRateWith(answer.sample);
    stepTheClockBy(answer.differenceMs);
    logger.info(
      { difference_ms: Math.round(answer.differenceMs), ntp_server: outcome.serverName },
      'server clock set to real time from NTP at boot',
    );
  }

  async function setToRealTimeNow(actor: string): Promise<SetToRealTimeOutcome> {
    const outcome = await pollForRealTime(quickPoll);
    if (!outcome.isAnswered) {
      logger.warn(
        { problems: outcome.problems, actor },
        'server clock not set: NTP gave no answer',
      );
      return { isSet: false, reason: 'noAnswer', problems: outcome.problems };
    }
    const answer = readTheAnswer(outcome);
    // The producer decided: taken however large, and the rate's window starts again,
    // since the answers before may read the jump as a rate.
    answersOfTheRateWindow = [answer.sample];
    differenceNotTakenMs = undefined;
    bigDifference = 'none';
    stepTheClockBy(answer.differenceMs);
    logger.warn(
      { difference_ms: Math.round(answer.differenceMs), actor },
      'server clock set to real time by hand ("Acertar relógio agora")',
    );
    return { isSet: true, steppedByMs: Math.round(answer.differenceMs) };
  }

  scheduleARegularPoll();

  return {
    stepToRealTimeAtBoot,
    setToRealTimeNow,
    readStatus: () => ({
      lastNtpAnswer,
      offFromRealTimeMs:
        lastNtpAnswer === undefined
          ? undefined
          : Math.round(differenceNotTakenMs ?? serverClock.readSlewLeftMs()),
      rate: serverClock.readRate(),
    }),
    stop: () => {
      isStopped = true;
      clearTimeout(nextPollTimer);
    },
  };
}
