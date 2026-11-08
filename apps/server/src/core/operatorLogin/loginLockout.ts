/** How many wrong PINs in a row one address may send before it has to wait. */
export const wrongPinsBeforeTheWait = 5;

/** How long the wait lasts. */
export const lockoutLengthInMilliseconds = 60_000;

/** What the lockout knows of one address. */
type WrongPinsOfOneAddress = { wrongPinsInARow: number; waitEndsAtMs: number | undefined };

/** The lockout of the login (BAJAOVRLAY-29): five wrong PINs in a row, then a minute's wait. */
export type LoginLockout = {
  /** The whole seconds the address still has to wait (rounded up), or 0 when it may try. */
  readSecondsToWait: (clientAddress: string) => number;
  /** Counts a wrong PIN; the fifth in a row starts the wait and answers its seconds. */
  recordWrongPin: (clientAddress: string) => number;
  /** A right PIN: the address starts from zero wrong PINs. */
  recordRightPin: (clientAddress: string) => void;
};

/**
 * Creates the lockout, kept in memory: a restart forgets the counts, which costs a guesser
 * a restart of the server, not a way in. Addresses are the TCP socket's (never
 * X-Forwarded-For, which any caller can write); behind the Vite dev proxy every page is
 * 127.0.0.1, so one person's typos make every dev page wait.
 */
export function createLoginLockout(readCurrentTime: () => Date): LoginLockout {
  const wrongPinsOfEachAddress = new Map<string, WrongPinsOfOneAddress>();

  function readSecondsToWait(clientAddress: string): number {
    const wrongPins = wrongPinsOfEachAddress.get(clientAddress);
    if (wrongPins?.waitEndsAtMs === undefined) {
      return 0;
    }
    const millisecondsLeft = wrongPins.waitEndsAtMs - readCurrentTime().getTime();
    if (millisecondsLeft <= 0) {
      // The wait is over: the address starts again from zero wrong PINs.
      wrongPinsOfEachAddress.delete(clientAddress);
      return 0;
    }
    return Math.ceil(millisecondsLeft / 1000);
  }

  function recordWrongPin(clientAddress: string): number {
    const wrongPins = wrongPinsOfEachAddress.get(clientAddress) ?? {
      wrongPinsInARow: 0,
      waitEndsAtMs: undefined,
    };
    const wrongPinsInARow = wrongPins.wrongPinsInARow + 1;
    if (wrongPinsInARow < wrongPinsBeforeTheWait) {
      wrongPinsOfEachAddress.set(clientAddress, { wrongPinsInARow, waitEndsAtMs: undefined });
      return 0;
    }
    const waitEndsAtMs = readCurrentTime().getTime() + lockoutLengthInMilliseconds;
    wrongPinsOfEachAddress.set(clientAddress, { wrongPinsInARow, waitEndsAtMs });
    return lockoutLengthInMilliseconds / 1000;
  }

  function recordRightPin(clientAddress: string): void {
    wrongPinsOfEachAddress.delete(clientAddress);
  }

  return { readSecondsToWait, recordWrongPin, recordRightPin };
}
