// The slices a screen is never sent. A screen is a renderer page: the program renderer OBS
// loads (`/ws?role=renderer`) or a copy of it the control page frames as its "Programa"
// or "Prévia" monitor (`/ws?role=monitor`). Graphics receive resolved data only
// (architecture rule 3), so a screen has no use for the data sources' raw answers
// (`dataSnapshots`) or for the operator's history (`eventLog`); parsing a 60-car
// snapshot every two seconds per source is a frame-drop risk inside OBS. Operator
// connections (the control page itself) still receive every slice. The hub applies this
// to the hello and to every change; GET /api/v1/state applies it when asked with `?role=`.
// What could go wrong: the role is not proven (anyone may connect as an operator, or
// call the state route with no role), so this saves the screens work and keeps race data
// out of OBS; it does not keep the data secret.
import type { SliceName, Slices } from '@bajaovrlay/shared';

/**
 * The name of a slice screens never receive. Each must be a list slice, because a
 * screen's hello carries it as an empty list: a name whose slice is not a list fails
 * typecheck in buildSlicesForAScreen.
 */
type SliceNameScreensNeverReceive = 'dataSnapshots' | 'eventLog';

/** The slices a screen never receives, in hello, in the state route or in any later message. */
export const sliceNamesScreensNeverReceive: readonly SliceNameScreensNeverReceive[] = [
  'dataSnapshots',
  'eventLog',
];

/**
 * A screen's copy of every slice, for its hello or its state read. The schema requires
 * every slice, so each hidden slice is there but empty: empty on purpose for a screen,
 * not "no data". The hidden names come from the list above, so the hello, the state
 * route and the changes agree.
 */
export function buildSlicesForAScreen(slices: Slices): Slices {
  const slicesForAScreen: Slices = { ...slices };
  for (const hiddenSliceName of sliceNamesScreensNeverReceive) {
    slicesForAScreen[hiddenSliceName] = [];
  }
  return slicesForAScreen;
}

/**
 * The changed slice names a screen is told about, in the same order. May be empty, and
 * then the screen is sent nothing for that change (a refused command, which changes the
 * event log alone, is one such change).
 */
export function removeSliceNamesScreensNeverReceive(changedSliceNames: SliceName[]): SliceName[] {
  return changedSliceNames.filter((changedSliceName) => {
    const isHiddenFromScreens = sliceNamesScreensNeverReceive.some(
      (hiddenSliceName) => hiddenSliceName === changedSliceName,
    );
    return !isHiddenFromScreens;
  });
}
