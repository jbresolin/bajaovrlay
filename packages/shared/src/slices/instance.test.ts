/**
 * An instance on the preview output: the fields it must stamp again, and who asked for
 * it (packages/shared)
 *
 * What this module is for:
 *   An instance is one graphic on one layer of one output. On the preview output it may
 *   carry `takeTimeFieldKeys`: the fields the server filled with the moment of the
 *   preview (a race clock's reference moment). When the operator sends the preview to
 *   air, the server writes the moment of the take over exactly those fields, so the clock
 *   starts at the take. The instance has to remember the keys, because by then the data
 *   holds plain numbers and nothing else says which of them was a stamp.
 *   A preview also carries `previewOrigin`: 'auto' when "Prévia automática" made it
 *   because the cursor arrived on an item, 'manual' when the operator asked for it. The
 *   next automatic preview throws the automatic ones away and leaves the manual ones.
 *
 * What these tests prove:
 *   - A preview instance carrying the list is accepted unchanged, and so is an instance
 *     without it (every instance written before this field existed).
 *   - A list holding an empty key, or a single text instead of a list, is refused.
 *   - A preview instance marked 'auto' or 'manual' is accepted unchanged; any other word
 *     is refused.
 *
 * What these tests deliberately do not cover:
 *   - Who writes the list and the origin and who reads them; the previewItem,
 *     takePreview and putGraphicOnOutputPreview tests in apps/server do.
 *   - That an instance on the program output never carries either: the schema allows it,
 *     and takePreview.test.ts proves the server never writes it.
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

describe('InstanceSchema and previewOrigin', () => {
  const acceptedPreviewOriginScenarios = [
    // The cursor arrived on the item and "Prévia automática" previewed it.
    { name: 'accepts a preview instance made by Prévia automática', previewOrigin: 'auto' },
    // A row's "Prévia" button, Shift+Space or "Edição rápida".
    { name: 'accepts a preview instance the operator asked for by hand', previewOrigin: 'manual' },
  ];

  it.each(acceptedPreviewOriginScenarios)('$name', ({ previewOrigin }) => {
    // Arrange: the previewed clock carrying the origin of this row.
    const previewedClockWithItsOrigin = { ...buildEnduroClockOnPreview(), previewOrigin };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(previewedClockWithItsOrigin);

    // Assert: it is accepted unchanged, the origin included.
    expect(result.success, 'a preview instance with a known origin must be accepted').toBe(true);
    expect(result.data, 'validation must not drop the origin').toEqual(previewedClockWithItsOrigin);
  });

  it('refuses an origin that is neither auto nor manual', () => {
    // Arrange: the previewed clock with a word the server never writes.
    const previewedClockWithUnknownOrigin = {
      ...buildEnduroClockOnPreview(),
      previewOrigin: 'automatica',
    };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(previewedClockWithUnknownOrigin);

    // Assert: it is refused, so no page ever has to guess what an unknown origin means.
    expect(result.success, 'an unknown preview origin must be refused').toBe(false);
  });
});
