// Test support: a count the fake OBS keeps (attempts refused, requests of a type,
// connections left without a greeting) that a test can wait on, so a test waits for the
// server's next move on the socket instead of on the clock.

/** A count that only goes up, and the way to wait until it reaches a number. */
export type CountWaitedOn = {
  /** The count now. */
  read: () => number;
  /** Adds one, and lets go of every wait that the new count reaches. */
  addOne: () => void;
  /** Resolves once the count is at least `target`: at once if it already is. */
  waitUntilItReaches: (target: number) => Promise<void>;
};

/** Creates a count at 0, with no one waiting on it. */
export function createCountWaitedOn(): CountWaitedOn {
  let count = 0;
  const waits: Array<{ target: number; resolve: () => void }> = [];

  return {
    read: () => count,
    addOne: () => {
      count += 1;
      for (const wait of [...waits]) {
        if (count >= wait.target) {
          waits.splice(waits.indexOf(wait), 1);
          wait.resolve();
        }
      }
    },
    waitUntilItReaches: (target) => {
      if (count >= target) {
        return Promise.resolve();
      }
      return new Promise((resolve) => waits.push({ target, resolve }));
    },
  };
}
