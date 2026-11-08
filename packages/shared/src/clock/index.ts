// Public surface of @bajaovrlay/shared/clock: the race clock's arithmetic and the
// server-aligned "now", with no Zod and no import from outside this folder, so a graphic
// can bundle it without carrying the rest of shared.

// One reading of a race clock, and the time the clock shows at any later moment.
export { type ClockReading, computeClockTimeMsAtWallClock } from './clockExtrapolation.js';
// The whole second a clock shows for a time in milliseconds, by its direction.
export { countWholeSecondsClockShows } from './clockWholeSeconds.js';
// The H:MM:SS text a clock shows for a time, written the same on air and on the page.
export { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
// The shared "now" on the server's clock: a page lines up at each hello and with its
// clock probes' answers (on this machine's monotonic time); tests forget it when they end.
export {
  type ClockProbeAnswerAsSeen,
  forgetTheServerClockAlignment,
  lineUpWithTheServerClockAt,
  probesAfterAHello,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordClockProbeAnswer,
} from './serverAlignedTime.js';
