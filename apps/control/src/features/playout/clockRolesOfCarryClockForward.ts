/**
 * The words by which a manifest tells the control page that a graphic is a clock, and
 * which of its properties play the four parts of one. This is the only file of the
 * control page that spells them.
 *
 * They pair with the server's update rule of the same name,
 * apps/server/src/core/store/updateRules/carryClockForward.ts: a graphic that names the
 * rule in `v_baja.updateRule` has the server keep its clock from jumping on an update,
 * and the control page then shows the time on screen in its time field. The server
 * finds the four properties by fixed keys; the control page may hold no graphic's key
 * names, so it finds them by `v_baja.role` on each property. packages/graphics/README.md
 * tells graphic authors both.
 * What could go wrong: the two sides are kept in step by hand. A role renamed here, or
 * left out of a manifest, makes the form show the reference time, as for any graphic.
 */

/** The value of `v_baja.updateRule` on the manifest of a graphic that is a clock. */
export const nameOfTheCarryClockForwardRule = 'carryClockForward';

/** On the mm:ss property (`v_baja.unit: "ms"`) holding the time the clock read. */
export const roleOfTheClockTimeField = 'clockTime';

/** On the integer property holding the moment that time was read; the server stamps it. */
export const roleOfTheReferenceMomentField = 'wallClock';

/** On the boolean property saying whether the clock runs or is held. */
export const roleOfTheRunningField = 'clockRunning';

/** On the property saying which way the clock counts: `elapsed` or `remaining`. */
export const roleOfTheClockModeField = 'clockMode';
