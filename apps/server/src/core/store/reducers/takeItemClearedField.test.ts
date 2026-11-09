/**
 * takeItem of an item with a cleared field (apps/server)
 *
 * What this module is for:
 *   `updateItemFields` can change a stored field but cannot remove one. So when the
 *   operator clears an optional field of a saved item (the leader's laps of a race
 *   clock, say), the item editor stores it as `{ kind: 'literal', value: null }`. At
 *   the take that null must not reach the graphic: takeItem hands its data to the
 *   internal take step putGraphicOnOutput every take ends in, which leaves a null field out.
 *
 * What these tests prove (with the race clock registered with its real data schema):
 *   - An item whose optional field is a literal null goes on air without that field,
 *     and the race clock's schema, which refuses a null lap count, accepts the take.
 *   - The stored item still holds the literal null afterwards.
 *   - An item whose REQUIRED field is a literal null is refused at the take with
 *     INVALID_GRAPHIC_DATA naming the field as missing, and nothing changes.
 *
 * What these tests deliberately do not cover:
 *   - The other rules of a take and of the cursor; takeItem.test.ts covers them.
 *   - A field stamped with the moment of the take; takeItemTakeTime.test.ts.
 */
import type { FieldValue, Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

const literalNull: FieldValue = { kind: 'literal', value: null };

/** Builds "Largada do enduro" with one of its fields stored as a cleared field. */
function buildEnduroStartItemWithClearedField(clearedFieldKey: string): Item {
  const startItem = buildEnduroStartItem(0);
  return { ...startItem, fields: { ...startItem.fields, [clearedFieldKey]: literalNull } };
}

/**
 * Builds the main session holding only the given item, with the cursor on it and the
 * race clock registered with its real data schema, so the take checks the data as
 * production does.
 */
function buildMainSessionWithItemAndTheRealClockSchema(item: Item): SlicesChangedByCommands {
  const raceClockWithItsDataSchema: Graphic = {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
  return {
    ...buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown(item.id)],
      items: [item],
    }),
    graphics: [raceClockWithItsDataSchema],
  };
}

describe('takeItem of an item whose optional field was cleared', () => {
  it('puts the race clock on air without the cleared lap count', () => {
    // Arrange: the start item, saved after the operator cleared the leader's laps.
    const slicesBefore = buildMainSessionWithItemAndTheRealClockSchema(
      buildEnduroStartItemWithClearedField('lapsCompletedByLeader'),
    );

    // Act: take the item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: accepted by the real schema; the data on air has the six clock fields and
    // no lap count at all; the stored item is the very same one, null included.
    expect(outcome.status, 'the race clock must accept an item with cleared laps').toBe('applied');
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(
      instanceOnAir?.resolvedData,
      'the cleared field must be absent from the data on air, not null',
    ).toEqual(buildEnduroClockData('green'));
    expect(
      outcome.status === 'applied' ? outcome.slices.items : undefined,
      'the take must not rewrite the stored item',
    ).toBe(slicesBefore.items);
  });
});

describe('takeItem of an item whose required field was cleared', () => {
  it('is refused, naming the field as missing, and changes nothing', () => {
    // Arrange: the start item with its session name stored as a cleared field, which
    // only a direct API call can produce (the editor refuses a blank required field).
    const slicesBefore = buildMainSessionWithItemAndTheRealClockSchema(
      buildEnduroStartItemWithClearedField('sessionName'),
    );
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: take the item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: the refusal the take step gives for data without the session name; nothing on air,
    // and the cursor still on the item.
    expect(outcome, 'an item missing a required field must be refused at the take').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "Título" é obrigatório e não foi enviado.',
      },
    });
    expect(slicesBefore, 'a refused take must change nothing').toEqual(copyOfSlicesBefore);
  });
});
