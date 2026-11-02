/**
 * What a screen is sent of OBS control (apps/server)
 *
 * What this module is for:
 *   A screen (the renderer OBS loads, or a monitor frame) draws BajaOvrLay's layers and
 *   nothing of OBS. The `obs` slice is an object, not a list, so it cannot go out "empty"
 *   like the slices a screen does not draw: it goes out as "no OBS", what a server with no
 *   address holds. The macros' stops go out as an empty list.
 *
 * What these tests prove:
 *   - With OBS connected and a macro stopped short on the server, a screen's copy still
 *     says "no OBS" and holds no stop.
 *
 * What these tests deliberately do not cover:
 *   - Every other slice a screen is or is not sent; webSocketHubScreenSlices.test.ts.
 */
import { obsSliceWithoutObs, type Slices } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildRaceDaySlicesWithRundown } from '../store/reducers/rundownSlices.testSupport.js';
import { buildSlicesForAScreen } from './slicesSentToScreens.js';

/** The race day's slices with OBS connected on "Pista" and "Pista + torre" stopped once. */
function buildSlicesWithObsConnected(): Slices {
  return {
    ...buildRaceDaySlicesWithRundown({ items: [] }),
    macroStops: [
      {
        macroId: 'macro-pista-e-torre',
        stepIndex: 0,
        reason: 'O OBS não está conectado.',
        stoppedAt: '2026-11-14T13:15:00.000Z',
      },
    ],
    obs: {
      connectionState: 'conectado',
      address: 'ws://127.0.0.1:4455',
      lastError: null,
      sceneNames: ['Pista', 'Box', 'Pódio'],
      programSceneName: 'Pista',
      isStudioModeOn: false,
      previewSceneName: null,
      sceneSwitch: null,
    },
    eventLog: [],
  };
}

describe('buildSlicesForAScreen and OBS', () => {
  it('sends a screen "no OBS" and no stop, whatever OBS is doing', () => {
    // Arrange: OBS connected and a macro stopped short, on the server.
    const slicesOnTheServer = buildSlicesWithObsConnected();

    // Act: build the program renderer's copy.
    const copyForTheScreen = buildSlicesForAScreen(slicesOnTheServer, 'program');

    // Assert: nothing of OBS and no stop reaches the screen.
    expect(copyForTheScreen.obs, 'a screen must be told "no OBS"').toEqual(obsSliceWithoutObs);
    expect(copyForTheScreen.macroStops, 'a screen draws no macro button').toEqual([]);
  });
});
