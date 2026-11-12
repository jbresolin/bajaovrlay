// Test support: a machine and the real world, on Vitest's fake time. The machine's
// monotonic time (fake performance) runs as fast as the test says against real time; NTP
// (a fake poll, answering at once) tells real time, and so do HTTPS Date headers (another
// fake poll, when the test turns that fallback on: BAJAOVRLAY-76); the machine may sleep
// (real time goes on, monotonic time does not) and its wall clock may be stepped as
// timesyncd does. A server clock and its discipline run on that machine, as startServer
// wires them.
// Every call builds fresh objects, so no test sees another's.
import { onTestFinished, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import type { HttpDatePollOutcome } from './httpDateClient.js';
import type { NtpPollOutcome, NtpPollRequest } from './ntpPolls.js';
import { createServerClock, type ServerClock } from './serverClock.js';
import { startServerClockDiscipline } from './serverClockDiscipline.js';

/** 10 October 2026, 13:00 UTC (10:00 in Brasília): the enduro is an hour in. */
export const tenOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** The NTP server the fake answers as. */
export const nameOfTheFakeNtpServer = 'a.st1.ntp.br:123';

/** The web server the fake HTTPS poll answers as. */
export const nameOfTheFakeHttpsServer = 'www.cloudflare.com';

/**
 * HTTPS answers from the track, in turn: the Date-header method is as good as the network
 * is even, so tens of ms either way, and the round trip of a kept-alive connection.
 */
export const httpsAnswersFromTheTrack: readonly NetworkOfOneAnswer[] = [
  { roundTripMs: 31, offsetErrorMs: 8 },
  { roundTripMs: 28, offsetErrorMs: -12 },
  { roundTripMs: 35, offsetErrorMs: 21 },
  { roundTripMs: 30, offsetErrorMs: -4 },
  { roundTripMs: 33, offsetErrorMs: 15 },
  { roundTripMs: 29, offsetErrorMs: -18 },
];

/** How one answer of the fake NTP came back: its round trip and how wrong its offset was. */
export type NetworkOfOneAnswer = { roundTripMs: number; offsetErrorMs: number };

/**
 * Answers over the internet from the track, in turn: round trips of 22 to 45 ms whose
 * offsets are off by up to 15 ms either way, unevenly, and every eighth one held up
 * 238 ms on the way back (the delay João's WSL measured), its offset off by 107 ms.
 * Each offset error is at most half of the extra round trip, as one-sided delays make it.
 */
export const answersOverTheInternetFromTheTrack: readonly NetworkOfOneAnswer[] = [
  { roundTripMs: 24, offsetErrorMs: 1 },
  { roundTripMs: 31, offsetErrorMs: -4 },
  { roundTripMs: 22, offsetErrorMs: 0 },
  { roundTripMs: 41, offsetErrorMs: 9 },
  { roundTripMs: 27, offsetErrorMs: -2 },
  { roundTripMs: 52, offsetErrorMs: -15 },
  { roundTripMs: 23, offsetErrorMs: 0 },
  { roundTripMs: 238, offsetErrorMs: 107 },
  { roundTripMs: 29, offsetErrorMs: 3 },
  { roundTripMs: 52, offsetErrorMs: 15 },
  { roundTripMs: 26, offsetErrorMs: -2 },
  { roundTripMs: 37, offsetErrorMs: 7 },
];

/** How the machine keeps time against the real world. */
export type MachineOfTheTest = {
  /** How much faster than real time its monotonic time runs: 0.04 for 4% fast. */
  monotonicRunsFastBy: number;
  /** How far its wall clock is from real time when the server boots: −5000 for 5 s behind. */
  wallClockAheadOfRealTimeAtBootMs: number;
  /** How the fake NTP's answers come back, in turn; one 12 ms round trip, exact, unless given. */
  networkOfEachAnswer?: readonly NetworkOfOneAnswer[];
  /** Whether the HTTPS fallback is on (BAJAOVRLAY_HTTP_TIME_SERVERS); off unless given. */
  isHttpsFallbackOn?: boolean;
  /** How the fake HTTPS answers come back, in turn; httpsAnswersFromTheTrack unless given. */
  networkOfEachHttpsAnswer?: readonly NetworkOfOneAnswer[];
};

/** One poll the discipline made: when (monotonic ms since the boot) and what it asked for. */
export type PollMade = { monotonicSinceBootMs: number } & NtpPollRequest;

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
  const networkOfEachAnswer = machine.networkOfEachAnswer ?? [
    { roundTripMs: 12, offsetErrorMs: 0 },
  ];
  let answersGiven = 0;
  let timeSleptMs = 0;
  let isNtpReachable = true;
  let isNtpAnsweringAtAll = true;
  let isNtpAskingToSlowDown = false;
  let howWrongNtpIsMs = 0;
  let isAnythingCountingTimeOnAir = false;
  let stepsToldToThePages = 0;
  let httpsAnswersGiven = 0;
  let isHttpsReachable = true;
  let isHttpsAnsweringAtAll = true;
  let howWrongHttpsIsMs = 0;
  const pollsMade: PollMade[] = [];
  const httpsPollsMadeAtMs: number[] = [];
  const stepsConsidered: number[] = [];

  /** Real time now: what NTP would tell. */
  function readRealTimeMs(): number {
    const monotonicSinceBootMs = serverClock.readMonotonicTimeMs() - monotonicAtBootMs;
    return (
      tenOClockOfTheEnduroMs +
      monotonicSinceBootMs / (1 + machine.monotonicRunsFastBy) +
      timeSleptMs
    );
  }

  /** The fake poll: real time at once, through the network of the next answer; or nothing. */
  function pollForRealTime(request: NtpPollRequest): Promise<NtpPollOutcome> {
    const monotonicNowMs = serverClock.readMonotonicTimeMs();
    pollsMade.push({ monotonicSinceBootMs: monotonicNowMs - monotonicAtBootMs, ...request });
    const wasAskedToSlowDown = isNtpAskingToSlowDown;
    if (!isNtpAnsweringAtAll) {
      // A poll that never ends, like one waiting on a network that is not there.
      return new Promise(() => {});
    }
    if (!isNtpReachable) {
      return Promise.resolve({
        isAnswered: false,
        problems: [`${nameOfTheFakeNtpServer}: timeout`],
        wasAskedToSlowDown,
      });
    }
    const network = networkOfEachAnswer[answersGiven % networkOfEachAnswer.length] ?? {
      roundTripMs: 12,
      offsetErrorMs: 0,
    };
    answersGiven += 1;
    const realTimeToldMs = readRealTimeMs() + howWrongNtpIsMs + network.offsetErrorMs;
    return Promise.resolve({
      isAnswered: true,
      serverName: nameOfTheFakeNtpServer,
      answer: {
        offsetMs: realTimeToldMs - monotonicNowMs,
        roundTripMs: network.roundTripMs,
        localTimeAtArrivalMs: monotonicNowMs,
      },
      wasAskedToSlowDown,
    });
  }

  /** The fake HTTPS poll: real time at once, through the next answer's network; or none. */
  function pollHttpDateServers(): Promise<HttpDatePollOutcome> {
    const monotonicNowMs = serverClock.readMonotonicTimeMs();
    httpsPollsMadeAtMs.push(monotonicNowMs - monotonicAtBootMs);
    if (!isHttpsAnsweringAtAll) {
      // A poll that never ends, like one waiting on a slow uplink.
      return new Promise(() => {});
    }
    if (!isHttpsReachable) {
      return Promise.resolve({
        isAnswered: false,
        problems: [`${nameOfTheFakeHttpsServer}: timeout`, 'only one server answered (www.ntp.br)'],
      });
    }
    const networkInTurn = machine.networkOfEachHttpsAnswer ?? httpsAnswersFromTheTrack;
    const network = networkInTurn[httpsAnswersGiven % networkInTurn.length] ?? {
      roundTripMs: 30,
      offsetErrorMs: 0,
    };
    httpsAnswersGiven += 1;
    const realTimeToldMs = readRealTimeMs() + howWrongHttpsIsMs + network.offsetErrorMs;
    return Promise.resolve({
      isAnswered: true,
      serverName: nameOfTheFakeHttpsServer,
      answer: {
        offsetMs: realTimeToldMs - monotonicNowMs,
        roundTripMs: network.roundTripMs,
        localTimeAtArrivalMs: monotonicNowMs,
      },
    });
  }

  const { logger, readRecordedLines } = createRecordingLogger();
  const discipline = startServerClockDiscipline({
    serverClock,
    pollForRealTime,
    isAnythingCountingTimeOnAir: (stepByMs) => {
      stepsConsidered.push(stepByMs);
      return isAnythingCountingTimeOnAir;
    },
    afterEachStep: () => {
      stepsToldToThePages += 1;
    },
    pollHttpDateServers: machine.isHttpsFallbackOn === true ? pollHttpDateServers : undefined,
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
    /** Every poll the discipline made, in order. */
    readPollsMade: () => [...pollsMade],
    /** When each HTTPS poll was made, in monotonic ms since the boot. */
    readHttpsPollsMadeAtMs: () => [...httpsPollsMadeAtMs],
    /** Each step the discipline asked about before stepping (what is on air may veto it). */
    readStepsConsidered: () => [...stepsConsidered],
    /** How many steps were reported for the pages to line up again. */
    countStepsToldToThePages: () => stepsToldToThePages,
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
    /** From now on every poll also brings a RATE kiss of death from one server. */
    makeNtpAskToSlowDown: (isAsking: boolean) => {
      isNtpAskingToSlowDown = isAsking;
    },
    /** The HTTPS servers stop answering, or answer again. */
    setHttpsReachable: (isReachable: boolean) => {
      isHttpsReachable = isReachable;
    },
    /** Every HTTPS poll from now on hangs, as on a very slow uplink. */
    makeHttpsNeverAnswer: () => {
      isHttpsAnsweringAtAll = false;
    },
    /** HTTPS tells a time this far from real time. */
    makeHttpsWrongBy: (wrongByMs: number) => {
      howWrongHttpsIsMs = wrongByMs;
    },
    /** NTP tells a time this far from real time: a box without its GPS fix. */
    makeNtpWrongBy: (wrongByMs: number) => {
      howWrongNtpIsMs = wrongByMs;
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

/**
 * For each pair of seconds in a row: how much longer (positive) or shorter the second on
 * air was than the one before, in ms. Small changes are a ramp or a slew; a change of
 * tens of ms at once is a second on air that visibly stretched.
 */
export function measureChangeFromTheSecondBefore(looks: readonly LookAtTheClocks[]): number[] {
  const millisecondsPerRealSecond = measureServerMillisecondsPerRealSecond(looks);
  return millisecondsPerRealSecond
    .slice(1)
    .map((lengthMs, secondNumber) => lengthMs - (millisecondsPerRealSecond[secondNumber] ?? 0));
}
