// One warning a minute per refused button poll (BAJAOVRLAY-56, gate 2). A D200 button
// with a wrong id or token is refused every second for the whole show; the first refusal
// of its path and status in each 60-second window is logged at warn, the rest at debug.

/** How long one warning covers the same path and status. */
const refusalWarningWindowInMilliseconds = 60_000;

/**
 * Past this many remembered windows, the closed ones are forgotten, so a caller who polls
 * ever-new paths cannot grow the map without end.
 */
const largestNumberOfWindowsKept = 1_000;

/** The windows of one server, kept in memory and lost on restart (a restart warns again). */
export type RefusalWarningWindows = {
  /**
   * Whether this refusal is the first of its path and status in a window, and so is the
   * one to log at warn. A window opens at that warning and lasts 60 s from it, however
   * often the button polls meanwhile.
   */
  isFirstRefusalOfItsWindow: (refusal: {
    path: string;
    httpStatus: number;
    atMilliseconds: number;
  }) => boolean;
};

/** Creates empty windows; the button state routes keep one set per server app. */
export function createRefusalWarningWindows(): RefusalWarningWindows {
  const windowStartOfEachRefusal = new Map<string, number>();

  return {
    isFirstRefusalOfItsWindow: ({ path, httpStatus, atMilliseconds }) => {
      const refusalKey = `${httpStatus} ${path}`;
      const windowStart = windowStartOfEachRefusal.get(refusalKey);
      const isInsideAnOpenWindow =
        windowStart !== undefined &&
        atMilliseconds - windowStart < refusalWarningWindowInMilliseconds;
      if (isInsideAnOpenWindow) {
        return false;
      }
      if (windowStartOfEachRefusal.size >= largestNumberOfWindowsKept) {
        forgetClosedWindows(windowStartOfEachRefusal, atMilliseconds);
      }
      windowStartOfEachRefusal.set(refusalKey, atMilliseconds);
      return true;
    },
  };
}

/** Deletes every window that has run its 60 s; deleting while iterating a Map is safe. */
function forgetClosedWindows(windowStarts: Map<string, number>, nowInMilliseconds: number): void {
  for (const [refusalKey, windowStart] of windowStarts) {
    const isClosed = nowInMilliseconds - windowStart >= refusalWarningWindowInMilliseconds;
    if (isClosed) {
      windowStarts.delete(refusalKey);
    }
  }
}
