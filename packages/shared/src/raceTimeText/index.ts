// Public surface of @bajaovrlay/shared/raceTimeText: race times written to the tenth,
// cut, with no Zod and no import from outside this folder, so a graphic can bundle it
// without carrying the rest of shared.

// Seconds to the tenth with a decimal comma ("12,3"): the body of a gap text.
export { writeSecondsToTheTenthCutAsText } from './raceTimeText.js';
// A lap time as the timing screen writes it ("4:38,2", "1:02:03,4" past an hour).
export { writeLapTimeAsText } from './raceTimeText.js';
