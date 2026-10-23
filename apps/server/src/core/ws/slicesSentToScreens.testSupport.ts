// Test support for the screen-slice tests (core/ws/webSocketHubScreenSlices.test.ts and
// api/v1/stateRoute.test.ts): what a screen should be sent, written out by hand rather
// than read from slicesSentToScreens.ts, so the tests check that file instead of
// repeating it. Nothing here keeps state between calls.
import type { SliceName, Slices } from '@bajaovrlay/shared';

/** The slices a screen draws, the only ones it is ever sent with something in them. */
export const sliceNamesAScreenDraws: SliceName[] = [
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
];

/**
 * The copy of the server's slices a screen should get: the four it draws as they are,
 * every other slice an empty list. Written out slice by slice so the reader sees each one.
 */
export function buildTheCopyAScreenShouldGet(slicesOnTheServer: Slices): Slices {
  return {
    layers: slicesOnTheServer.layers,
    graphics: slicesOnTheServer.graphics,
    instances: slicesOnTheServer.instances,
    previewClearedLayerIds: slicesOnTheServer.previewClearedLayerIds,
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    instanceBindings: [],
    overrides: [],
    eventLog: [],
  };
}
