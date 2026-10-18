// The slices a renderer connection (`/ws?role=renderer`) is never sent. Graphics receive
// resolved data only (architecture rule 3), so the renderer has no use for the data
// sources' raw answers, and parsing a 60-car snapshot every two seconds per source is a
// frame-drop risk inside OBS. Operator connections (the control page and its monitors)
// still receive every slice.
// What could go wrong: the role is not proven (anyone may connect as an operator), and
// GET /api/v1/state still returns every slice; this filter saves the renderer work, it
// does not keep the data secret.
import type { SliceName, Slices } from '@bajaovrlay/shared';

/**
 * The name of a slice renderers never receive. Each must be a list slice, because the
 * renderer's hello carries it as an empty list: a name whose slice is not a list fails
 * typecheck in buildSlicesForARendererHello.
 */
type SliceNameRenderersNeverReceive = 'dataSnapshots';

/** The slices a renderer connection never receives, in hello or in any later message. */
export const sliceNamesRenderersNeverReceive: readonly SliceNameRenderersNeverReceive[] = [
  'dataSnapshots',
];

/**
 * The renderer's copy of every slice, for its hello. The hello schema requires every
 * slice, so each hidden slice is there but empty: empty on purpose for a renderer, not
 * "no data". The hidden names come from the list above, so the hello and the changes agree.
 */
export function buildSlicesForARendererHello(slices: Slices): Slices {
  const slicesForARenderer: Slices = { ...slices };
  for (const hiddenSliceName of sliceNamesRenderersNeverReceive) {
    slicesForARenderer[hiddenSliceName] = [];
  }
  return slicesForARenderer;
}

/**
 * The changed slice names a renderer is told about, in the same order. May be empty,
 * and then the renderer is sent nothing for that change.
 */
export function removeSliceNamesRenderersNeverReceive(changedSliceNames: SliceName[]): SliceName[] {
  return changedSliceNames.filter((changedSliceName) => {
    const isHiddenFromRenderers = sliceNamesRenderersNeverReceive.some(
      (hiddenSliceName) => hiddenSliceName === changedSliceName,
    );
    return !isHiddenFromRenderers;
  });
}
