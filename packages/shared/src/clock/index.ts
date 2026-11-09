// Public surface of @bajaovrlay/shared/clock: the race clock's arithmetic and the
// server-aligned "now", with no Zod and no import from outside this folder, so a graphic
// can bundle it without carrying the rest of shared.

// One reading of a race clock, and the time the clock shows at any later moment.
export { type ClockReading, computeClockTimeMsAtWallClock } from './clockExtrapolation.js';
// The whole second a clock shows for a time in milliseconds, by its direction.
export { countWholeSecondsClockShows } from './clockWholeSeconds.js';
// The H:MM:SS text a clock shows for a time, written the same on air and on the page.
export { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
// The shared "now" on the server's clock: a page starts lining up at each hello and at a
// new step count of the server clock, and lines up with its clock probes' answers (on
// this machine's monotonic time); tests set it directly, and forget it when they end.
export {
  type ClockProbeAnswerAsSeen,
  forgetTheServerClockAlignment,
  type HelloAsSeen,
  lineUpWithTheServerClockAt,
  probesAfterAHello,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordClockProbeAnswer,
  startLiningUpAgainIfTheServerClockStepped,
  startLiningUpAtAHello,
} from './serverAlignedTime.js';
