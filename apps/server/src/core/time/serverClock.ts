/**
 * The server's one time source for clock math. It counts on the machine's monotonic
 * time (performance.timeOrigin + performance.now()), which never moves back, set to the
 * wall clock once when it is created.
 *
 * Why: under load, the time sync of WSL2 and of Docker Desktop's Linux VM (the stream
 * PC runs the server there) steps the wall clock by about a second every thirty. A race
 * clock stamped from the wall clock then repeated or skipped a second on air
 * (BAJAOVRLAY-62). Monotonic time ignores those steps.
 *
 * What could go wrong: over hours the monotonic time drifts from the wall clock by small
 * amounts, and a sync that corrects the wall clock leaves a difference too. The
 * re-anchoring (serverClockReanchoring.ts) measures that drift once a minute and covers
 * it 50 ms at a time while no clock runs on air.
 */

/** Where a server clock reads the machine's time; tests fake both through Vitest. */
type MachineTimeSources = {
  /** The wall clock, in ms since 1970: what a time sync steps. */
  readWallClockMs: () => number;
  /** Monotonic time, in ms since 1970 at the start of the process: never steps. */
  readMonotonicMs: () => number;
};

/** One server clock: what it reads, how far it is from the wall clock, and its shift. */
export type ServerClock = {
  /** The server clock's time, in whole ms since 1970. Never moves back but by a shift. */
  readCurrentTimeMs: () => number;
  /** readCurrentTimeMs as a Date, for the options named readCurrentTime. */
  readCurrentTime: () => Date;
  /** The wall clock minus the server clock, in whole ms: positive when it is behind. */
  measureDriftFromWallClockMs: () => number;
  /** Moves the server clock by the given ms from now on (the re-anchoring's step). */
  shiftServerTimeBy: (milliseconds: number) => void;
};

/** The machine's own clocks; Vitest's fake Date and fake performance replace both. */
const machineTimeSources: MachineTimeSources = {
  readWallClockMs: () => Date.now(),
  readMonotonicMs: () => performance.timeOrigin + performance.now(),
};

/**
 * Creates a server clock set to the wall clock now. The server makes one per process
 * (serverClockOfTheProcess); tests make their own after faking the machine's clocks.
 */
export function createServerClock(): ServerClock {
  const { readWallClockMs, readMonotonicMs } = machineTimeSources;
  // What is added to monotonic time to read the wall clock's time. Set once here, and
  // moved only by shiftServerTimeBy.
  let anchorOffsetMs = readWallClockMs() - readMonotonicMs();

  function readCurrentTimeMs(): number {
    // Monotonic time comes with fractions of a millisecond; every moment the server
    // stamps is a whole number. Rounding down keeps it from ever moving back.
    return Math.floor(readMonotonicMs() + anchorOffsetMs);
  }

  return {
    readCurrentTimeMs,
    readCurrentTime: () => new Date(readCurrentTimeMs()),
    measureDriftFromWallClockMs: () => Math.round(readWallClockMs() - readCurrentTimeMs()),
    shiftServerTimeBy: (milliseconds: number) => {
      anchorOffsetMs += milliseconds;
    },
  };
}

/**
 * The process's server clock, created when the server's code is loaded at boot. Every
 * default `readCurrentTime` of the server reads it, through readServerTime.
 */
export const serverClockOfTheProcess = createServerClock();

/** The process's server clock as a Date: the default of every `readCurrentTime` option. */
export function readServerTime(): Date {
  return serverClockOfTheProcess.readCurrentTime();
}
