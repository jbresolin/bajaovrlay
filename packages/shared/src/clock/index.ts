// Public surface of @bajaovrlay/shared/clock: the race clock's arithmetic, with no Zod
// and no other import, so a graphic can bundle it without carrying the rest of shared.

// One reading of a race clock, and the time the clock shows at any later moment.
export { type ClockReading, computeClockTimeMsAtWallClock } from './clockExtrapolation.js';
// The whole second a clock shows for a time in milliseconds, by its direction.
export { countWholeSecondsClockShows } from './clockWholeSeconds.js';
