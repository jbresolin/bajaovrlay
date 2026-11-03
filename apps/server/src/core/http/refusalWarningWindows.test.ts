/**
 * One warning a minute per refused button poll (apps/server)
 *
 * What this module is for:
 *   A D200 button set up with a wrong id, or a wrong token, is refused on every poll, once
 *   a second, for as long as the show runs (BAJAOVRLAY-56, gate 2). It must show up in the
 *   log at warn, but not 3,600 times an hour. These windows decide which refusal is the
 *   first of its path and status in a 60-second window, and so is logged at warn.
 *
 * What these tests prove (with times given by hand, no clock):
 *   - The first refusal of a path and status is the first of its window.
 *   - The same path and status inside the 60 s is not; at 60 s exactly a new window opens.
 *   - Another status on the same path, or another path, has a window of its own.
 *   - A window opens at the warning, not at each poll, so steady polling warns once a minute.
 *
 * What these tests deliberately do not cover:
 *   - Which log level a poll gets in the app; buttonStatePollRefusalLog.test.ts, with fake time.
 */
import { describe, expect, it } from 'vitest';

import { createRefusalWarningWindows } from './refusalWarningWindows.js';

/** One refused poll: its path, its status, and when it came (ms from the first). */
type RefusedPoll = { path: string; httpStatus: number; atMilliseconds: number };

/** A layer id mistyped in Ulanzi Studio. */
const mistypedLayerPath = '/api/v1/state/layer/placar-inexistente';

/** A macro deleted after its D200 button was set up. */
const deletedMacroPath = '/api/v1/state/macro/macro-apagada';

const windowScenarios: Array<{
  name: string;
  polls: RefusedPoll[];
  expectedFirstOfWindow: boolean[];
}> = [
  // The first time a mis-set button is refused, someone must see it.
  {
    name: 'the first refusal of a path warns',
    polls: [{ path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 0 }],
    expectedFirstOfWindow: [true],
  },
  // The poll a second later, and the last one before the minute is up, are the same news.
  {
    name: 'the same path and status inside 60 s is quiet',
    polls: [
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 0 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 1_000 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 59_999 },
    ],
    expectedFirstOfWindow: [true, false, false],
  },
  // A minute later the button is still wrong: say so again, once.
  {
    name: 'the same path and status at 60 s opens a new window',
    polls: [
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 0 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 60_000 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 60_500 },
    ],
    expectedFirstOfWindow: [true, true, false],
  },
  // The API turned off (403) after the token was refused (401) is a new problem.
  {
    name: 'another status on the same path has its own window',
    polls: [
      { path: mistypedLayerPath, httpStatus: 401, atMilliseconds: 0 },
      { path: mistypedLayerPath, httpStatus: 403, atMilliseconds: 2_000 },
    ],
    expectedFirstOfWindow: [true, true],
  },
  // Two mis-set buttons are two problems; one must not hide the other.
  {
    name: 'another path has its own window',
    polls: [
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 0 },
      { path: deletedMacroPath, httpStatus: 404, atMilliseconds: 1_000 },
    ],
    expectedFirstOfWindow: [true, true],
  },
  // Polls at 0, 30, 60 and 90 s: the window counts from the warning at 0, so 60 warns and
  // 90 does not (a window restarted by every poll would never warn again).
  {
    name: 'a window counts from its warning, not from the last poll',
    polls: [
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 0 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 30_000 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 60_000 },
      { path: mistypedLayerPath, httpStatus: 404, atMilliseconds: 90_000 },
    ],
    expectedFirstOfWindow: [true, false, true, false],
  },
];

describe('refusal warning windows', () => {
  it.each(windowScenarios)('$name', ({ polls, expectedFirstOfWindow }) => {
    // Arrange: fresh windows, as a new server starts with.
    const refusalWarningWindows = createRefusalWarningWindows();

    // Act: hand each refused poll of the row to the windows, in order.
    const firstOfWindowAnswers = polls.map((poll) =>
      refusalWarningWindows.isFirstRefusalOfItsWindow(poll),
    );

    // Assert: exactly the polls the row expects open a window.
    expect(firstOfWindowAnswers, 'which polls are logged at warn').toEqual(expectedFirstOfWindow);
  });
});
