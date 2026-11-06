/**
 * Building the messages that carry slices (apps/server)
 *
 * What this module is for:
 *   After a state change the hub sends each operator one `slices` message with every
 *   slice that change changed, built by buildSlicesMessage with one case per slice name.
 *   A name with no case would be left out silently, and the page would keep that slice as
 *   its hello had it: BAJAOVRLAY-20 found exactly that for its two new slices
 *   (instanceBindings and overrides), whose changes never reached the control page.
 *
 * What these tests prove:
 *   - buildSlicesMessage copies every slice sent whole, for every name there is, so a slice
 *     added later without its case fails here.
 *   - A correction set with setOverride and the bindings of a new take travel in the
 *     message, as they are in the slices.
 *
 * What these tests deliberately do not cover:
 *   - Which slices a screen is sent; webSocketHubScreenSlices.test.ts.
 *   - Sending the message; webSocketHubGroupedSlices.test.ts.
 */
import {
  obsSliceWithoutObs,
  type SliceNameSentWhole,
  SliceNameSentWholeSchema,
  type Slices,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildSlicesMessage } from './serverMessageBuilding.js';

/**
 * Every slice, each its own new list (empty is enough: the test compares the lists
 * themselves, and every list here is a different object).
 */
function buildSlicesEachAListOfItsOwn(): Slices {
  return {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: [],
    graphics: [],
    instances: [],
    previewClearedLayerIds: [],
    instanceBindings: [],
    programHistory: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    macroStops: [],
    obs: obsSliceWithoutObs,
    triggers: [],
    triggerActivity: { isPaused: false, lastFiredAtMsByTriggerId: {}, firings: [] },
    dataSources: [],
    dataSnapshots: [],
    overrides: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    eventLog: [],
  };
}

describe('buildSlicesMessage', () => {
  it('copies every slice sent whole, whatever its name', () => {
    // Arrange: every slice its own list, and every name sent whole.
    const slices = buildSlicesEachAListOfItsOwn();
    const everyNameSentWhole: SliceNameSentWhole[] = SliceNameSentWholeSchema.options;

    // Act: build the message of a change of every one of them.
    const message = buildSlicesMessage(everyNameSentWhole, slices, 1_791_556_325_000);

    // Assert: every name is a key of the message, holding that very slice.
    expect(Object.keys(message.slices).sort(), 'no slice may be left out').toEqual(
      [...everyNameSentWhole].sort(),
    );
    for (const sliceName of everyNameSentWhole) {
      expect(
        message.slices[sliceName],
        `the slice ${sliceName} must be the one the server holds`,
      ).toBe(slices[sliceName as keyof Slices]);
    }
  });

  it('carries the correction of a session name and the bindings of a take', () => {
    // Arrange: slices holding one correction and one instance's bindings.
    const slices: Slices = {
      ...buildSlicesEachAListOfItsOwn(),
      overrides: [
        {
          sourceId: 'simulador-enduro',
          scope: 'session',
          field: 'sessionName',
          value: 'Enduro — Etapa Nacional',
          reason: 'Nome oficial da prova.',
          setBy: 'operador:3f2a9c1e',
          setAt: '2026-10-09T14:32:05.000Z',
        },
      ],
      instanceBindings: [
        {
          instanceId: 'relogio-no-ar',
          boundFields: [
            {
              fieldKey: 'state',
              binding: {
                kind: 'binding',
                sourceId: 'simulador-enduro',
                shapeKey: 'session',
                path: 'state',
                isLive: true,
              },
            },
          ],
        },
      ],
    };

    // Act: the message of a setOverride, then of a take.
    const correctionMessage = buildSlicesMessage(['overrides', 'eventLog'], slices, 0);
    const takeMessage = buildSlicesMessage(
      ['instances', 'instanceBindings', 'eventLog'],
      slices,
      0,
    );

    // Assert: both new slices travel.
    expect(correctionMessage.slices.overrides, 'the correction must reach the pages').toEqual(
      slices.overrides,
    );
    expect(takeMessage.slices.instanceBindings, 'the bindings must reach the pages').toEqual(
      slices.instanceBindings,
    );
  });
});
