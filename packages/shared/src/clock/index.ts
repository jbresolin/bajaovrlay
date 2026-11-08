// Public surface of @bajaovrlay/shared/clock: the race clock's arithmetic and the
// server-aligned "now", with no Zod and no import from outside this folder, so a graphic
// can bundle it without carrying the rest of shared.

// One reading of a race clock, and the time the clock shows at any later moment.
export { type ClockReading, computeClockTimeMsAtWallClock } from './clockExtrapolation.js';
// The whole second a clock shows for a time in milliseconds, by its direction.
export { countWholeSecondsClockShows } from './clockWholeSeconds.js';
// The H:MM:SS text a clock shows for a time, written the same on air and on the page.
export { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
// The shared "now" on the server's clock; the renderer records a sample per message
// (taken on this machine's monotonic time), and tests forget the samples when they end.
export {
  forgetServerClockSamples,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordServerClockSample,
} from './serverAlignedTime.js';
// The samples behind that "now": the last five offsets kept, and their median.
export {
  computeMedianOfOffsetSamples,
  keepLatestOffsetSamples,
  offsetSampleLimit,
} from './serverClockOffsetSamples.js';
