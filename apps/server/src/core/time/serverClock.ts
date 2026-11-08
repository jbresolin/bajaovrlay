/**
 * The server's one time source for clock math. It counts on the machine's monotonic
 * time (performance.timeOrigin + performance.now()), which never moves back, set to the
 * wall clock once when it is created, and kept on real time from NTP by
 * serverClockDiscipline.ts in three ways:
 * - a rate: monotonic time is multiplied by it, so a machine whose monotonic time runs
 *   4% fast (João's WSL under load) still counts seconds of real time;
 * - a slew: a small difference is covered at most 0.5% of the time passing, so a second
 *   on air lasts between 0.995 s and 1.005 s, which no one can see;
 * - a step: a big difference, moved at once.
 *
 * Why not the wall clock: under load, the time sync of WSL2 and of Docker Desktop's
 * Linux VM (the stream PC runs the server there) steps the wall clock by about a second
 * every thirty, and a race clock stamped from it repeated or skipped a second on air
 * (BAJAOVRLAY-62). Nothing here reads the wall clock after the clock is created.
 */

/** Where a server clock reads the machine's time; tests fake both through Vitest. */
type MachineTimeSources = {
  /** The wall clock, in ms since 1970: what a time sync steps. Read once, at creation. */
  readWallClockMs: () => number;
  /** Monotonic time, in ms since 1970 at the start of the process: never steps. */
  readMonotonicMs: () => number;
};

/** The most a slew moves the clock, as a share of the time passing: 0.5%. */
export const largestSlewShare = 0.005;

/** One server clock: what it reads, and the three ways the discipline moves it. */
export type ServerClock = {
  /** The server clock's time, in whole ms since 1970. Never moves back but by a step. */
  readCurrentTimeMs: () => number;
  /** readCurrentTimeMs as a Date, for the options named readCurrentTime. */
  readCurrentTime: () => Date;
  /** The machine's monotonic time, in ms: what NTP's answers are measured against. */
  readMonotonicTimeMs: () => number;
  /** What the server clock read (or reads) at a moment of monotonic time, unrounded. */
  readServerTimeAtMonotonicMs: (monotonicMs: number) => number;
  /** Runs at a new rate of real time per monotonic time from now on (1 / 1.04 for 4% fast). */
  runAtRate: (rate: number) => void;
  /** The rate in use; 1 until NTP has measured one. */
  readRate: () => number;
  /** Covers a difference at 0.5% of the time passing; replaces a slew in progress. */
  slewBy: (differenceMs: number) => void;
  /** What the slew in progress has still to cover, in whole ms; 0 when there is none. */
  readSlewLeftMs: () => number;
  /** Moves the clock by a difference at once; ends a slew in progress. */
  stepBy: (differenceMs: number) => void;
};

/** The machine's own clocks; Vitest's fake Date and fake performance replace both. */
const machineTimeSources: MachineTimeSources = {
  readWallClockMs: () => Date.now(),
  readMonotonicMs: () => performance.timeOrigin + performance.now(),
};

/**
 * Creates a server clock set to the wall clock now. The server makes one per process
 * (serverClockOfTheProcess); tests make their own after faking the machine's clocks.
 *
 * How it reads: from a base (a moment of monotonic time and what the clock read then),
 * the clock adds the monotonic time since, times the rate, plus as much of the slew as
 * 0.5% of that time allows. Each change (a rate, a slew, a step) first moves the base to
 * now, so the change never moves what the clock reads at that moment, except a step.
 */
export function createServerClock(): ServerClock {
  const { readWallClockMs, readMonotonicMs } = machineTimeSources;
  let baseMonotonicMs = readMonotonicMs();
  let baseServerTimeMs = readWallClockMs();
  let rate = 1;
  // The slew still to cover from the base on; signed: positive moves the clock ahead.
  let slewFromTheBaseMs = 0;

  /** How much of the slew is covered by a moment of monotonic time after the base. */
  function readSlewCoveredAt(monotonicMs: number): number {
    const monotonicSinceTheBaseMs = Math.max(monotonicMs - baseMonotonicMs, 0);
    // 0.5% of the time passing at the rate (real time), not of monotonic time: on a
    // machine 4% fast that keeps every second on air within 0.995–1.005 s of real time.
    const mostThatCanBeCoveredMs = monotonicSinceTheBaseMs * rate * largestSlewShare;
    const slewCoveredMs = Math.min(Math.abs(slewFromTheBaseMs), mostThatCanBeCoveredMs);
    return Math.sign(slewFromTheBaseMs) * slewCoveredMs;
  }

  function readServerTimeAtMonotonicMs(monotonicMs: number): number {
    const monotonicSinceTheBaseMs = monotonicMs - baseMonotonicMs;
    return baseServerTimeMs + monotonicSinceTheBaseMs * rate + readSlewCoveredAt(monotonicMs);
  }

  /** Moves the base to now, keeping what the clock reads and the slew still to cover. */
  function moveTheBaseToNow(): void {
    const nowMonotonicMs = readMonotonicMs();
    const slewCoveredMs = readSlewCoveredAt(nowMonotonicMs);
    baseServerTimeMs = readServerTimeAtMonotonicMs(nowMonotonicMs);
    slewFromTheBaseMs -= slewCoveredMs;
    baseMonotonicMs = nowMonotonicMs;
  }

  function readCurrentTimeMs(): number {
    // Every moment the server stamps is a whole number. Rounding down keeps it from ever
    // moving back, since the clock never runs slower than 0.9 − 0.005 of monotonic time.
    return Math.floor(readServerTimeAtMonotonicMs(readMonotonicMs()));
  }

  return {
    readCurrentTimeMs,
    readCurrentTime: () => new Date(readCurrentTimeMs()),
    readMonotonicTimeMs: readMonotonicMs,
    readServerTimeAtMonotonicMs,
    runAtRate: (newRate: number) => {
      moveTheBaseToNow();
      rate = newRate;
    },
    readRate: () => rate,
    slewBy: (differenceMs: number) => {
      moveTheBaseToNow();
      slewFromTheBaseMs = differenceMs;
    },
    readSlewLeftMs: () => {
      const slewLeftMs = slewFromTheBaseMs - readSlewCoveredAt(readMonotonicMs());
      return Math.round(slewLeftMs);
    },
    stepBy: (differenceMs: number) => {
      moveTheBaseToNow();
      baseServerTimeMs += differenceMs;
      slewFromTheBaseMs = 0;
    },
  };
}

/**
 * The process's server clock, created when the server's code is loaded at boot. Every
 * default `readCurrentTime` of the server reads it, through readServerTime; at boot,
 * startServer has NTP step it before anything else reads it (serverClockDiscipline.ts).
 */
export const serverClockOfTheProcess = createServerClock();

/** The process's server clock as a Date: the default of every `readCurrentTime` option. */
export function readServerTime(): Date {
  return serverClockOfTheProcess.readCurrentTime();
}
