import type { ServerClockLastAnswer } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import {
  estimateRateOfRealTime,
  findTheLongestRoundTripKeptMs,
  keepTheAnswersOfTheRateWindow,
  type RealTimeSample,
} from './realTimeRate.js';
import type { ServerClock } from './serverClock.js';

/** A new rate is ramped to over this much monotonic time, not taken at once. */
export const rampToANewRateMs = 60_000;

/** The rate's window of answers, as the discipline of the server clock keeps it. */
export type RealTimeRateWindow = {
  /** Adds an answer to the window and ramps to the new estimate, if any. */
  correctTheRateWith: (newestSample: RealTimeSample) => void;
  /** Whether an answer's round trip is an outlier among the window's (and its own). */
  isARoundTripOutlier: (sample: RealTimeSample) => boolean;
  /** The window holds this answer alone from now on; the rate in use stays. */
  startAgainFrom: (sample: RealTimeSample) => void;
  /**
   * Empties the window when the answers start coming from another source (NTP after
   * HTTPS, or the reverse): two sources tens of ms apart would read as a rate.
   */
  startAgainOnANewSource: (source: ServerClockLastAnswer['source']) => void;
  /** Whether a rate has been measured since the boot. */
  hasARateBeenMeasured: () => boolean;
};

/**
 * The answers of the last eight minutes and the rate they give (realTimeRate.ts),
 * ramped to on the server clock over a minute (BAJAOVRLAY-62); split from the discipline
 * when HTTPS became a second source of answers (BAJAOVRLAY-76).
 */
export function createRealTimeRateWindow(options: {
  serverClock: ServerClock;
  logger: ServerLogger;
}): RealTimeRateWindow {
  const { serverClock, logger } = options;
  let answersOfTheRateWindow: RealTimeSample[] = [];
  let hasARateBeenMeasured = false;
  let sourceOfTheRateWindow: ServerClockLastAnswer['source'] | undefined;

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

  function isARoundTripOutlier(sample: RealTimeSample): boolean {
    const longestRoundTripKeptMs = findTheLongestRoundTripKeptMs([
      ...answersOfTheRateWindow,
      sample,
    ]);
    return sample.roundTripMs > longestRoundTripKeptMs;
  }

  function startAgainOnANewSource(source: ServerClockLastAnswer['source']): void {
    if (sourceOfTheRateWindow !== undefined && sourceOfTheRateWindow !== source) {
      answersOfTheRateWindow = [];
    }
    sourceOfTheRateWindow = source;
  }

  return {
    correctTheRateWith,
    isARoundTripOutlier,
    startAgainFrom: (sample) => {
      answersOfTheRateWindow = [sample];
    },
    startAgainOnANewSource,
    hasARateBeenMeasured: () => hasARateBeenMeasured,
  };
}
