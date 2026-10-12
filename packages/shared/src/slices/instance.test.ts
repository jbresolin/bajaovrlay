/**
 * An instance on the preview output and the fields it must stamp again (packages/shared)
 *
 * What this module is for:
 *   An instance is one graphic on one layer of one output. On the preview output it may
 *   carry `takeTimeFieldKeys`: the fields the server filled with the moment of the
 *   preview (a race clock's reference moment). When the operator sends the preview to
 *   air, the server writes the moment of the take over exactly those fields, so the clock
 *   starts at the take. The instance has to remember the keys, because by then the data
 *   holds plain numbers and nothing else says which of them was a stamp.
 *
 * What these tests prove:
 *   - A preview instance carrying the list is accepted unchanged, and so is an instance
 *     without it (every instance written before this field existed).
 *   - A list holding an empty key, or a single text instead of a list, is refused.
 *
 * What these tests deliberately do not cover:
 *   - Who writes the list and who reads it; the previewItem, previewGraphic and
 *     takePreview reducer tests in apps/server do.
 *   - The other fields of an instance; slices.test.ts covers status and statusDetail.
 */
import { describe, expect, it } from 'vitest';

import { InstanceSchema } from './instance.js';

/** Builds the enduro clock on the preview output of the clock layer, stamped at 14:32:05 UTC. */
function buildEnduroClockOnPreview() {
  return {
    id: 'e5a9d3b1-6c2f-4d8a-b7e4-3f1c0a9e8d27',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'preview',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      referenceWallClockMs: 1_791_556_325_000,
    },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:32:05.000Z',
  };
}

describe('InstanceSchema and takeTimeFieldKeys', () => {
  it('accepts a preview instance that remembers which field was stamped', () => {
    // Arrange: the previewed clock, remembering that its reference moment was a stamp.
    const previewedClock = {
      ...buildEnduroClockOnPreview(),
      takeTimeFieldKeys: ['referenceWallClockMs'],
    };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(previewedClock);

    // Assert: it is accepted unchanged, the list included.
    expect(result.success, 'a preview instance with its stamp list must be accepted').toBe(true);
    expect(result.data, 'validation must not drop the stamp list').toEqual(previewedClock);
  });

  it('accepts an instance without the list, as every instance was before it existed', () => {
    // Arrange: the same previewed clock with no list at all.
    const previewedClockWithoutTheList = buildEnduroClockOnPreview();

    // Act: check the instance.
    const result = InstanceSchema.safeParse(previewedClockWithoutTheList);

    // Assert: it is accepted and no list is invented for it.
    expect(result.success, 'the stamp list must be optional').toBe(true);
    expect(result.data, 'no list may be added to an instance that had none').toEqual(
      previewedClockWithoutTheList,
    );
  });

  const refusedStampListScenarios = [
    // An empty key names no field, so the take could not stamp anything with it.
    { name: 'refuses a list that holds an empty key', takeTimeFieldKeys: [''] },
    // One text instead of a list is a server bug that must not be stored.
    {
      name: 'refuses a single text in place of the list',
      takeTimeFieldKeys: 'referenceWallClockMs',
    },
  ];

  it.each(refusedStampListScenarios)('$name', ({ takeTimeFieldKeys }) => {
    // Arrange: the previewed clock with the broken list of this row.
    const previewedClockWithBrokenList = { ...buildEnduroClockOnPreview(), takeTimeFieldKeys };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(previewedClockWithBrokenList);

    // Assert: it is refused.
    expect(result.success, 'a broken stamp list must be refused').toBe(false);
  });
});
