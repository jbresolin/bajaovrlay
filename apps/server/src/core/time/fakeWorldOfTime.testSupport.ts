// Test support: a machine and the real world, on Vitest's fake time. The machine's
// monotonic time (fake performance) runs as fast as the test says against real time; NTP
// (a fake poll, answering at once) tells real time; the machine may sleep (real time goes
// on, monotonic time does not) and its wall clock may be stepped as timesyncd does. A
// server clock and its discipline run on that machine, as startServer wires them.
// Every call builds fresh objects, so no test sees another's.
import { onTestFinished, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import type { NtpPollOutcome } from './ntpPolls.js';
import { createServerClock, type ServerClock } from './serverClock.js';
import { startServerClockDiscipline } from './serverClockDiscipline.js';

/** 10 October 2026, 13:00 UTC (10:00 in Brasília): the enduro is an hour in. */
export const tenOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** The NTP server the fake answers as. */
export const nameOfTheFakeNtpServer = 'a.st1.ntp.br:123';

/** How the machine keeps time against the real world. */
export type MachineOfTheTest = {
  /** How much faster than real time its monotonic time runs: 0.04 for 4% fast. */
  monotonicRunsFastBy: number;
  /** How far its wall clock is from real time when the server boots: −5000 for 5 s behind. */
  wallClockAheadOfRealTimeAtBootMs: number;
};

/**
 * Fakes the machine's clocks and timers at ten o'clock, and starts a server clock and its
 * discipline on them. Returns the controls of the world and what the test reads.
 */
export function startAServerClockInAFakeWorld(machine: MachineOfTheTest) {
  vi.useFakeTimers({
    toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'],
    now: tenOClockOfTheEnduroMs + machine.wallClockAheadOfRealTimeAtBootMs,
  });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const serverClock: ServerClock = createServerClock();
  const monotonicAtBootMs = serverClock.readMonotonicTimeMs();
  let timeSleptMs = 0;
  let isNtpReachable = true;
  let isNtpAnsweringAtAll = true;
  let isAnythingCountingTimeOnAir = false;

  /** Real time now: what NTP would tell. */
  function readRealTimeMs(): number {
    const monotonicSinceBootMs = serverClock.readMonotonicTimeMs() - monotonicAtBootMs;
    return (
      tenOClockOfTheEnduroMs +
      monotonicSinceBootMs / (1 + machine.monotonicRunsFastBy) +
      timeSleptMs
    );
  }

  /** The fake poll: real time at once, with a 12 ms round trip; or no answer. */
  function pollForRealTime(): Promise<NtpPollOutcome> {
    if (!isNtpAnsweringAtAll) {
      // A poll that never ends, like one waiting on a network that is not there.
      return new Promise(() => {});
    }
    if (!isNtpReachable) {
      return Promise.resolve({
        isAnswered: false,
        problems: [`${nameOfTheFakeNtpServer}: timeout`],
      });
    }
    const localTimeAtArrivalMs = serverClock.readMonotonicTimeMs();
    return Promise.resolve({
      isAnswered: true,
      serverName: nameOfTheFakeNtpServer,
      answer: {
        offsetMs: readRealTimeMs() - localTimeAtArrivalMs,
        roundTripMs: 12,
        localTimeAtArrivalMs,
      },
    });
  }

  const { logger, readRecordedLines } = createRecordingLogger();
  const discipline = startServerClockDiscipline({
    serverClock,
    pollForRealTime,
    isAnythingCountingTimeOnAir: () => isAnythingCountingTimeOnAir,
    logger,
  });
  onTestFinished(() => {
    discipline.stop();
  });

  return {
    serverClock,
    discipline,
    readRealTimeMs,
    readRecordedLines,
    /** The machine sleeps: real time moves on by the given ms, monotonic time does not. */
    sleepFor: (sleepMs: number) => {
      timeSleptMs += sleepMs;
    },
    /** The uplink goes down (no answer) or comes back. */
    setNtpReachable: (isReachable: boolean) => {
      isNtpReachable = isReachable;
    },
    /** Every poll from now on hangs, as with no network at boot. */
    makeNtpNeverAnswer: () => {
      isNtpAnsweringAtAll = false;
    },
    /** A running clock or a countdown goes on air, or comes off. */
    setSomethingCountingTimeOnAir: (isCounting: boolean) => {
      isAnythingCountingTimeOnAir = isCounting;
    },
  };
}

/** One look at the clocks: real time and the server clock (unrounded), together. */
export type LookAtTheClocks = { realTimeMs: number; serverTimeMs: number };

/**
 * Lets time pass in steps of one second of monotonic time, looking at both clocks after
 * each; every `wallClockStepEveryMs` the wall clock is stepped back 1 s, as timesyncd
 * did on João's WSL every 32 s. Returns every look, in order.
 */
export async function watchTheClocksFor(
  world: ReturnType<typeof startAServerClockInAFakeWorld>,
  durationMs: number,
  options: { wallClockStepEveryMs?: number } = {},
): Promise<LookAtTheClocks[]> {
  const looks: LookAtTheClocks[] = [];
  let sinceTheLastWallClockStepMs = 0;
  for (let watchedMs = 0; watchedMs < durationMs; watchedMs += 1_000) {
    await vi.advanceTimersByTimeAsync(1_000);
    sinceTheLastWallClockStepMs += 1_000;
    const isTimeForAWallClockStep =
      options.wallClockStepEveryMs !== undefined &&
      sinceTheLastWallClockStepMs >= options.wallClockStepEveryMs;
    if (isTimeForAWallClockStep) {
      vi.setSystemTime(Date.now() - 1_000);
      sinceTheLastWallClockStepMs = 0;
    }
    const monotonicNowMs = world.serverClock.readMonotonicTimeMs();
    looks.push({
      realTimeMs: world.readRealTimeMs(),
      serverTimeMs: world.serverClock.readServerTimeAtMonotonicMs(monotonicNowMs),
    });
  }
  return looks;
}

/**
 * For each pair of looks in a row: how many ms the clock on air moved during each
 * second of real time. Between 995 and 1005 means no second on air lasted less than
 * 0.995 s or more than 1.005 s.
 */
export function measureServerMillisecondsPerRealSecond(
  looks: readonly LookAtTheClocks[],
): number[] {
  const measures: number[] = [];
  for (let lookNumber = 1; lookNumber < looks.length; lookNumber += 1) {
    const earlierLook = looks[lookNumber - 1];
    const laterLook = looks[lookNumber];
    if (earlierLook === undefined || laterLook === undefined) {
      continue;
    }
    const realMovedMs = laterLook.realTimeMs - earlierLook.realTimeMs;
    const serverMovedMs = laterLook.serverTimeMs - earlierLook.serverTimeMs;
    measures.push((serverMovedMs / realMovedMs) * 1_000);
  }
  return measures;
}
