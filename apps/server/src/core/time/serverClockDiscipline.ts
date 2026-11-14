import type { ServerClockLastAnswer } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import {
  type AnsweredPoll,
  type AnswerTaken,
  readAnAnsweredPoll,
} from './answeredPollOfRealTime.js';
import { pollForRealTimeWithinTheBootWait } from './bootPollForRealTime.js';
import type { HttpDatePollOutcome } from './httpDateClient.js';
import { type NtpPollOutcome, type NtpPollRequest, questionsPerPoll } from './ntpPolls.js';
import { createRealTimeRateWindow } from './realTimeRateWindow.js';
import type { ServerClock } from './serverClock.js';
import {
  findTheNextPollIntervalMs,
  httpsPollIntervalMs,
  intervalBeforeAConfirmationMs,
  slowDownAfterARateKiss,
} from './serverClockPollIntervals.js';
import { createSourceFollowedRecord } from './serverClockSourceFollowed.js';
import type {
  LastNtpAnswer,
  ServerClockStatus,
  SetToRealTimeOutcome,
} from './serverClockStatus.js';

/** From this difference on, the offset is stepped (when nothing on air counts time). */
export const bigDifferenceMs = 1_000;

/**
 * Past this, NTP's time is not taken on its own (a track-side box without GPS may be years
 * off); at boot, a machine with a dead clock battery waits for "Acertar relógio agora" too.
 */
export const largestDifferenceTakenOnItsOwnMs = 24 * 60 * 60 * 1000;

/** The running discipline of the server clock. */
export type ServerClockDiscipline = {
  /** The boot's first correction: a step, waiting up to 3 s for NTP. Never rejects. */
  stepToRealTimeAtBoot: () => Promise<void>;
  /** "Acertar relógio agora": asks NTP now and steps, whatever is on air. */
  setToRealTimeNow: (actor: string) => Promise<SetToRealTimeOutcome>;
  readStatus: () => ServerClockStatus;
  /** Stops polling, ending a poll in flight at once; may be called more than once. */
  stop: () => void;
};

/** What the discipline needs: the clock it corrects, how to poll, what is on air, a logger. */
export type ServerClockDisciplineOptions = {
  serverClock: ServerClock;
  /** One poll of NTP (ntpPolls.ts) on monotonic time; `abortSignal` ends it at once. */
  pollForRealTime: (request: NtpPollRequest, abortSignal: AbortSignal) => Promise<NtpPollOutcome>;
  /** Whether a step by this much would make anything on program or preview jump. */
  isAnythingCountingTimeOnAir: (stepByMs: number) => boolean;
  /** Called after each step, so every page lines up again at once. */
  afterEachStep?: (() => void) | undefined;
  /**
   * One poll of the HTTPS servers' Date headers (httpDateClient.ts), asked only once NTP
   * has been quiet for a full poll interval; undefined when BAJAOVRLAY_HTTP_TIME_SERVERS
   * is off.
   */
  pollHttpDateServers?: ((abortSignal: AbortSignal) => Promise<HttpDatePollOutcome>) | undefined;
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
 *
 * When NTP has given no answer for a full poll interval (64 s), each poll that NTP leaves
 * unanswered asks the Date headers of HTTPS servers instead (BAJAOVRLAY-76), every 64 s,
 * and their answer goes through the very same rules above. Why HTTPS comes second: its
 * precision is tens of ms (a whole-second header, timed against the network's evenness),
 * NTP's a few ms; but HTTPS gets through networks that block UDP 123. NTP is still asked
 * first at every poll, and takes over as soon as it answers; the change of source starts
 * the rate's window again, since two sources tens of ms apart would read as a rate.
 */
export function startServerClockDiscipline(
  options: ServerClockDisciplineOptions,
): ServerClockDiscipline {
  const { serverClock, pollForRealTime, isAnythingCountingTimeOnAir, logger } = options;
  const rateWindow = createRealTimeRateWindow({ serverClock, logger });
  let answersTaken = 0;
  let lastNtpAnswer: LastNtpAnswer | undefined;
  let bigDifference: BigDifferenceState = 'none';
  let serverOfTheBigDifference: string | undefined;
  // A difference over 24 h not taken, reported for the header while NTP keeps telling it.
  let differenceNotTakenMs: number | undefined;
  let slowDownFactor = 1;
  const sourceFollowed = createSourceFollowedRecord({
    readMonotonicTimeMs: serverClock.readMonotonicTimeMs,
    isHttpsFallbackOn: options.pollHttpDateServers !== undefined,
    logger,
  });
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;
  // Aborted by stop(): a poll in flight closes its socket and sends nothing more.
  const stopController = new AbortController();

  /** Reads an answered poll of either source, and records it for the reports. */
  function readTheAnswer(
    outcome: AnsweredPoll,
    source: ServerClockLastAnswer['source'],
  ): AnswerTaken {
    const answer = readAnAnsweredPoll(outcome, source, serverClock);
    if (answer.lastNtpAnswer !== undefined) {
      lastNtpAnswer = answer.lastNtpAnswer;
    }
    sourceFollowed.noteAnswerRead(answer.lastAnswer);
    return answer;
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
      const isAnOutlier = rateWindow.isARoundTripOutlier(sample);
      rateWindow.correctTheRateWith(sample);
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
        'server clock is 1 s or more off real time; polling again in 16 s (another NTP server first) to confirm',
      );
      return true;
    }
    if (bigDifference === 'waitingForConfirmation' && rateWindow.hasARateBeenMeasured()) {
      // Confirmed: real time jumped against monotonic time (a sleep, a server reset). The
      // answers before the jump would read it as a rate, so the window starts again here;
      // the rate in use stays. Before any rate, the difference is the machine's own rate.
      rateWindow.startAgainFrom(sample);
    } else {
      rateWindow.correctTheRateWith(sample);
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
        'a time (NTP or HTTPS) more than 24 h from the server clock not taken; "Acertar relógio agora" takes it',
      );
    }
    differenceNotTakenMs = differenceMs;
    return true;
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
    const outcome = await pollForRealTime(request, stopController.signal);
    if (isStopped) {
      return;
    }
    sourceFollowed.noteNtpPoll(outcome);
    noteWhetherNtpAskedToSlowDown(outcome);
    if (outcome.isAnswered) {
      correctWithTheAnswerOfAPoll(readTheAnswer(outcome, 'ntp'));
      return;
    }
    if (options.pollHttpDateServers !== undefined && sourceFollowed.isNtpQuiet()) {
      await pollHttpsAndCorrect(options.pollHttpDateServers);
      return;
    }
    scheduleARegularPoll();
  }

  /** NTP quiet for a full poll interval: the HTTPS servers' Date headers instead. */
  async function pollHttpsAndCorrect(
    pollHttpDateServers: (abortSignal: AbortSignal) => Promise<HttpDatePollOutcome>,
  ): Promise<void> {
    const outcome = await pollHttpDateServers(stopController.signal);
    if (isStopped) {
      return;
    }
    sourceFollowed.noteHttpsPoll(outcome);
    if (!outcome.isAnswered) {
      scheduleARegularPoll();
      return;
    }
    correctWithTheAnswerOfAPoll(readTheAnswer(outcome, 'https'));
  }

  /**
   * Takes the answer of a regular or confirming poll, from either source, and schedules
   * the next poll: a confirmation 16 s later after a new big difference, else a regular one.
   */
  function correctWithTheAnswerOfAPoll(answer: AnswerTaken): void {
    if (isNotToBeTakenOnItsOwn(answer.differenceMs)) {
      scheduleARegularPoll();
      return;
    }
    answersTaken += 1;
    rateWindow.startAgainOnANewSource(answer.source);
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
    const isFollowingHttps =
      options.pollHttpDateServers !== undefined && sourceFollowed.isNtpQuiet();
    const intervalMs = isFollowingHttps
      ? httpsPollIntervalMs
      : findTheNextPollIntervalMs({ answersTaken, slowDownFactor });
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
    const outcome = await pollForRealTimeWithinTheBootWait(
      (abortSignal) => pollForRealTime(quickPoll, abortSignal),
      stopController.signal,
    );
    if (isStopped) {
      return;
    }
    if (outcome === undefined || !outcome.isAnswered) {
      sourceFollowed.noteNoNtpAnswerAtBoot();
      logger.warn(
        { problems: outcome?.problems ?? ['no answer within 3 s'] },
        "server clock starts on the machine's wall clock: NTP gave no answer at boot",
      );
      return;
    }
    sourceFollowed.noteNtpPoll(outcome);
    const answer = readTheAnswer(outcome, 'ntp');
    if (isNotToBeTakenOnItsOwn(answer.differenceMs)) {
      return;
    }
    answersTaken += 1;
    rateWindow.startAgainOnANewSource('ntp');
    rateWindow.correctTheRateWith(answer.sample);
    stepTheClockBy(answer.differenceMs);
    logger.info(
      { difference_ms: Math.round(answer.differenceMs), ntp_server: outcome.serverName },
      'server clock set to real time from NTP at boot',
    );
  }

  /**
   * "Acertar relógio agora"'s poll: NTP's quick poll, then, when NTP gives no answer and
   * the fallback is on, the HTTPS servers' (a venue that blocks NTP still lets the
   * producer set the clock). The answer read, or every problem.
   */
  async function pollForTheProducer(): Promise<
    { isAnswered: true; answer: AnswerTaken } | { isAnswered: false; problems: string[] }
  > {
    const ntpOutcome = await pollForRealTime(quickPoll, stopController.signal);
    if (ntpOutcome.isAnswered) {
      return { isAnswered: true, answer: readTheAnswer(ntpOutcome, 'ntp') };
    }
    if (options.pollHttpDateServers === undefined) {
      return { isAnswered: false, problems: ntpOutcome.problems };
    }
    const httpsOutcome = await options.pollHttpDateServers(stopController.signal);
    if (httpsOutcome.isAnswered) {
      return { isAnswered: true, answer: readTheAnswer(httpsOutcome, 'https') };
    }
    return { isAnswered: false, problems: [...ntpOutcome.problems, ...httpsOutcome.problems] };
  }

  async function setToRealTimeNow(actor: string): Promise<SetToRealTimeOutcome> {
    const outcome = await pollForTheProducer();
    if (!outcome.isAnswered) {
      logger.warn(
        { problems: outcome.problems, actor },
        'server clock not set: no time server gave an answer',
      );
      return { isSet: false, reason: 'noAnswer', problems: outcome.problems };
    }
    const { answer } = outcome;
    // The producer decided: taken however large, and the rate's window starts again,
    // since the answers before may read the jump as a rate.
    rateWindow.startAgainOnANewSource(answer.source);
    rateWindow.startAgainFrom(answer.sample);
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
        sourceFollowed.readLastAnswer() === undefined
          ? undefined
          : Math.round(differenceNotTakenMs ?? serverClock.readSlewLeftMs()),
      rate: serverClock.readRate(),
      source: sourceFollowed.readSourceFollowed(),
      isWithoutSync: sourceFollowed.isWithoutSync(),
    }),
    stop: () => {
      isStopped = true;
      clearTimeout(nextPollTimer);
      stopController.abort();
    },
  };
}
