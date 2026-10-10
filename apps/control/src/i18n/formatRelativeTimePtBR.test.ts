/**
 * Relative times in pt-BR (apps/control)
 *
 * What this module is for:
 *   The layer panel says since when a graphic has been on air, the way a person would:
 *   "há 2 min". formatRelativeTimePtBR is the one function on the control page that
 *   writes such times, so they read the same everywhere.
 *
 * What these tests prove:
 *   - Under one minute reads "agora"; then whole minutes, whole hours and whole days,
 *     always rounded down ("há 2 min" stays until the third minute is complete).
 *   - A moment slightly in the future (the server's clock ahead of this machine's)
 *     reads "agora" instead of a negative time.
 *
 * What these tests deliberately do not cover:
 *   - Refreshing the text as time passes; LayerStatusPanel.test.tsx covers that.
 *   - Calendar dates ("9 de outubro"): nothing on the page shows one yet.
 */
import { describe, expect, it } from 'vitest';

import { formatRelativeTimePtBR } from './formatRelativeTimePtBR';

// Every scenario asks "how long ago was this?" at the same moment: 10:00 in Brasília
// on the Saturday of the endurance race.
const momentOfAsking = new Date('2026-10-10T13:00:00.000Z');

const relativeTimeScenarios = [
  // The take just happened: seconds would only flicker, so the panel says "agora".
  { name: 'says "agora" 5 seconds after', pastMoment: '2026-10-10T12:59:55.000Z', text: 'agora' },
  // The last second before the first whole minute still reads "agora".
  { name: 'says "agora" 59 seconds after', pastMoment: '2026-10-10T12:59:01.000Z', text: 'agora' },
  // The first whole minute.
  {
    name: 'says "há 1 min" exactly 1 minute after',
    pastMoment: '2026-10-10T12:59:00.000Z',
    text: 'há 1 min',
  },
  // Rounds down: 2 min 59 s is still "há 2 min", the example in the task brief.
  {
    name: 'says "há 2 min" 2 minutes and 59 seconds after',
    pastMoment: '2026-10-10T12:57:01.000Z',
    text: 'há 2 min',
  },
  // The last minute before the unit changes to hours.
  {
    name: 'says "há 59 min" 59 minutes after',
    pastMoment: '2026-10-10T12:01:00.000Z',
    text: 'há 59 min',
  },
  // A four-hour endurance race: the clock has been on air since the start.
  { name: 'says "há 4 h" 4 hours after', pastMoment: '2026-10-10T09:00:00.000Z', text: 'há 4 h' },
  // A graphic left on overnight: singular "dia".
  {
    name: 'says "há 1 dia" 30 hours after',
    pastMoment: '2026-10-09T07:00:00.000Z',
    text: 'há 1 dia',
  },
  // A graphic left on since the first day of the event: plural "dias".
  {
    name: 'says "há 3 dias" 3 days after',
    pastMoment: '2026-10-07T13:00:00.000Z',
    text: 'há 3 dias',
  },
  // The server's clock is 2 seconds ahead of the operator's laptop: never "há -1 min".
  {
    name: 'says "agora" for a moment 2 seconds in the future',
    pastMoment: '2026-10-10T13:00:02.000Z',
    text: 'agora',
  },
];

describe('formatRelativeTimePtBR', () => {
  it.each(relativeTimeScenarios)('$name', ({ pastMoment, text }) => {
    // Arrange: the moment something happened, as the server writes it.
    const momentItHappened = new Date(pastMoment);

    // Act: ask how long ago that was.
    const relativeTime = formatRelativeTimePtBR(momentItHappened, momentOfAsking);

    // Assert: the answer is the pt-BR text an operator expects.
    expect(relativeTime, 'the elapsed time must be worded as in the scenario name').toBe(text);
  });
});
