import type { ServerClockLastAnswer, ServerClockSource } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import type { HttpDatePollOutcome } from './httpDateClient.js';
import type { NtpPollOutcome } from './ntpPolls.js';
import { ntpPollIntervalMs } from './serverClockPollIntervals.js';

/** How long NTP may give no answer before HTTPS feeds the discipline: one poll interval. */
export const ntpQuietBeforeHttpsMs = ntpPollIntervalMs;

/**
 * How many NTP polls in a row must get no answer before HTTPS feeds the discipline (the
 * boot's counts). One is not enough: on a lossy uplink a lost UDP packet loses a poll now
 * and then, and the clock would flap between the sources, each change emptying the rate's
 * window, so the rate would never settle.
 */
export const unansweredNtpPollsInARowBeforeHttps = 2;

/** NTP's default port, left out of a server's name for the operator. */
const ntpPortSuffix = ':123';

/** The record of which source the discipline follows, and of the last answers. */
export type SourceFollowedRecord = {
  /** After each NTP poll but the boot's: answered or not. */
  noteNtpPoll: (outcome: NtpPollOutcome) => void;
  /** The boot got no NTP answer; it warns itself, so this says nothing. */
  noteNoNtpAnswerAtBoot: () => void;
  /** After each HTTPS poll: answered or not. */
  noteHttpsPoll: (outcome: HttpDatePollOutcome) => void;
  /** An answer the discipline read, from either source. */
  noteAnswerRead: (lastAnswer: ServerClockLastAnswer) => void;
  /**
   * Whether NTP has given no answer for a full poll interval (64 s) or more, over two
   * polls in a row at least.
   */
  isNtpQuiet: () => boolean;
  readLastAnswer: () => ServerClockLastAnswer | undefined;
  /** What "Verificar servidor" and the header's menu say the clock follows. */
  readSourceFollowed: () => ServerClockSource;
  /**
   * Whether neither NTP nor HTTPS has answered for a full poll interval: NTP quiet for
   * 64 s, and HTTPS off or its last poll unanswered. The header's "Relógio sem
   * sincronização" (the addition of 2026-11-12); cleared by the first good answer.
   */
  isWithoutSync: () => boolean;
};

/**
 * Keeps which source the server clock follows (BAJAOVRLAY-76): NTP while it answers (or
 * has been quiet for less than 64 s), HTTPS once NTP has been quiet for 64 s over two
 * lost polls in a row and while the HTTPS servers answer, otherwise none (the computer's own clock, at its last rate). Each
 * change is logged, a warning only once per outage. `isHttpsFallbackOn` is false when
 * BAJAOVRLAY_HTTP_TIME_SERVERS is off.
 */
export function createSourceFollowedRecord(options: {
  readMonotonicTimeMs: () => number;
  isHttpsFallbackOn: boolean;
  logger: ServerLogger;
}): SourceFollowedRecord {
  const { readMonotonicTimeMs, isHttpsFallbackOn, logger } = options;
  // The start counts as an answer: the boot's 3 s and the first polls are not "quiet".
  let monotonicOfTheLastNtpAnswerMs = readMonotonicTimeMs();
  // True at the start, so that a boot without NTP is warned by the boot itself only.
  let didNtpAnswerTheLastPoll = true;
  let unansweredNtpPollsInARow = 0;
  let isNtpQuietForAFullInterval = false;
  let didHttpsAnswerTheLastPoll = false;
  // Not the same as "did not answer": while the first HTTPS poll is under way it has
  // neither answered nor failed, and the header must not flash "sem sincronização".
  let didHttpsFailItsLastPoll = false;
  // Whether HTTPS's silence was warned in this outage; reset when it answers.
  let wasHttpsSilenceWarned = false;
  let lastAnswer: ServerClockLastAnswer | undefined;

  function noteNtpPoll(outcome: NtpPollOutcome): void {
    if (outcome.isAnswered) {
      if (!didNtpAnswerTheLastPoll) {
        const whatFollows = isNtpQuietForAFullInterval ? '; the server clock follows it again' : '';
        logger.info({ ntp_server: outcome.serverName }, `NTP answers again${whatFollows}`);
      }
      monotonicOfTheLastNtpAnswerMs = readMonotonicTimeMs();
      didNtpAnswerTheLastPoll = true;
      unansweredNtpPollsInARow = 0;
      isNtpQuietForAFullInterval = false;
      didHttpsFailItsLastPoll = false;
      return;
    }
    if (didNtpAnswerTheLastPoll) {
      logger.warn(
        { problems: outcome.problems },
        'NTP gave no answer; the server clock runs on at its last rate',
      );
    }
    didNtpAnswerTheLastPoll = false;
    unansweredNtpPollsInARow += 1;
    const quietForMs = readMonotonicTimeMs() - monotonicOfTheLastNtpAnswerMs;
    // Both: 64 s with no answer, and two lost polls in a row (see
    // unansweredNtpPollsInARowBeforeHttps for why one lost poll is not enough).
    const isQuietForLongEnough =
      quietForMs >= ntpQuietBeforeHttpsMs &&
      unansweredNtpPollsInARow >= unansweredNtpPollsInARowBeforeHttps;
    if (isQuietForLongEnough && !isNtpQuietForAFullInterval) {
      isNtpQuietForAFullInterval = true;
      if (isHttpsFallbackOn) {
        logger.warn(
          'NTP quiet for a full poll interval; the server clock follows the Date headers of HTTPS servers',
        );
      }
    }
  }

  function noteHttpsPoll(outcome: HttpDatePollOutcome): void {
    didHttpsAnswerTheLastPoll = outcome.isAnswered;
    didHttpsFailItsLastPoll = !outcome.isAnswered;
    if (outcome.isAnswered) {
      wasHttpsSilenceWarned = false;
      return;
    }
    if (!wasHttpsSilenceWarned) {
      wasHttpsSilenceWarned = true;
      logger.warn(
        { problems: outcome.problems },
        'HTTPS Date headers gave no answer either; the server clock runs on at its last rate',
      );
    }
  }

  function readSourceFollowed(): ServerClockSource {
    if (lastAnswer === undefined) {
      return { following: 'none', lastAnswer: null };
    }
    const isFollowingNtp = !isNtpQuietForAFullInterval && lastAnswer.source === 'ntp';
    if (isFollowingNtp) {
      return { following: 'ntp', lastAnswer };
    }
    const isFollowingHttps =
      isNtpQuietForAFullInterval && didHttpsAnswerTheLastPoll && lastAnswer.source === 'https';
    if (isFollowingHttps) {
      return { following: 'https', lastAnswer };
    }
    return { following: 'none', lastAnswer };
  }

  return {
    noteNtpPoll,
    noteNoNtpAnswerAtBoot: () => {
      didNtpAnswerTheLastPoll = false;
      unansweredNtpPollsInARow = 1;
    },
    noteHttpsPoll,
    noteAnswerRead: (answer) => {
      lastAnswer = answer;
    },
    isNtpQuiet: () => isNtpQuietForAFullInterval,
    isWithoutSync: () =>
      isNtpQuietForAFullInterval && (!isHttpsFallbackOn || didHttpsFailItsLastPoll),
    readLastAnswer: () => lastAnswer,
    readSourceFollowed,
  };
}

/** An NTP server's name as the operator reads it: `a.st1.ntp.br`, the port only if not 123. */
export function nameAnNtpServerForTheOperator(serverName: string): string {
  return serverName.endsWith(ntpPortSuffix)
    ? serverName.slice(0, -ntpPortSuffix.length)
    : serverName;
}
