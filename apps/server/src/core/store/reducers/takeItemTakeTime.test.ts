/**
 * takeItem and takeNext with a field stamped at the take (apps/server)
 *
 * What this module is for:
 *   A race clock counts from a reference moment. An item prepared hours before the
 *   session cannot know that moment, so its `referenceWallClockMs` field may say
 *   `{ kind: 'takeTime' }`: "use the moment this item goes on air". The reducer gets the
 *   moment of the command from the store (the same one it writes in `takenAt`) and the
 *   field becomes that moment in milliseconds.
 *
 * What these tests prove (with the race clock registered with its real data schema):
 *   - The instance on air carries the milliseconds of the take in the stamped field, the
 *     same moment as its `takenAt`, and the race clock's schema accepts it.
 *   - Taking the same item again later stamps the later moment.
 *   - takeNext, the Space key, stamps the field exactly as takeItem does.
 *   - The stored item still says `takeTime` afterwards.
 *
 * What these tests deliberately do not cover:
 *   - The store reading the real clock and saving the result; storeTakeTimeField.test.ts.
 *   - The other rules of a take and of the cursor; takeItem.test.ts covers them.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

// The moment contextOfTheRundownCommand names, 14:32:05 UTC on 9 October 2026, in
// milliseconds; and a later command, at 14:47:30.250 UTC the same day.
const momentOfTheTakeInMilliseconds = 1_791_556_325_000;
const contextOfTheLaterCommand: ReducerContext = {
  ...contextOfTheRundownCommand,
  newInstanceId: 'e2a4c6f8-1b3d-4f5a-8c7e-9d0b1a2c3e4f',
  now: '2026-10-09T14:47:30.250Z',
};
const momentOfTheLaterTakeInMilliseconds = 1_791_557_250_250;

/** Builds "Largada do enduro" with a clock at zero that starts counting at the take. */
function buildEnduroStartItemThatStartsAtTheTake(): Item {
  const startItem = buildEnduroStartItem(0);
  return {
    ...startItem,
    fields: {
      ...startItem.fields,
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'takeTime' },
    },
  };
}

/**
 * Builds the main session holding only that item, with the cursor on it and the race
 * clock registered with its real data schema, so the take checks the data as production does.
 */
function buildMainSessionWithTheStartItemAndTheRealClockSchema(): SlicesChangedByCommands {
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
      rundowns: [buildMainSessionRundown('item-largada-do-enduro')],
      items: [buildEnduroStartItemThatStartsAtTheTake()],
    }),
    graphics: [raceClockWithItsDataSchema],
  };
}

describe('takeItem of an item whose clock starts at the take', () => {
  it('puts the milliseconds of the take in the stamped field, and the clock schema accepts it', () => {
    // Arrange: the start item, prepared with its reference moment left to the take.
    const slicesBefore = buildMainSessionWithTheStartItemAndTheRealClockSchema();

    // Act: take it at 14:32:05.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: accepted by the real schema; the data carries the take in milliseconds,
    // which is the same moment `takenAt` says in words; the item itself is unchanged.
    expect(outcome.status, 'the race clock must accept the stamped data').toBe('applied');
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(instanceOnAir?.resolvedData, 'the stamped field must be the take in ms').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 0,
      referenceWallClockMs: momentOfTheTakeInMilliseconds,
      running: true,
    });
    expect(
      new Date(momentOfTheTakeInMilliseconds).toISOString(),
      'the stamped moment and takenAt must be one and the same moment',
    ).toBe(instanceOnAir?.takenAt);
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : undefined;
    expect(itemsAfter, 'the stored item must still say takeTime, for the next take').toBe(
      slicesBefore.items,
    );
  });

  it('stamps the later moment when the same item is taken again later', () => {
    // Arrange: the start item already taken once at 14:32:05.
    const firstOutcome = reduceCommand(
      buildMainSessionWithTheStartItemAndTheRealClockSchema(),
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheRundownCommand,
    );
    const slicesAfterFirstTake =
      firstOutcome.status === 'applied'
        ? firstOutcome.slices
        : buildMainSessionWithTheStartItemAndTheRealClockSchema();

    // Act: take it again at 14:47:30.250, as after a restart of the race.
    const secondOutcome = reduceCommand(
      slicesAfterFirstTake,
      { type: 'takeItem', itemId: 'item-largada-do-enduro' },
      contextOfTheLaterCommand,
    );

    // Assert: one clock on air, counting from the second take and not from the first.
    expect(firstOutcome.status, 'the first take must be accepted').toBe('applied');
    const instancesAfter =
      secondOutcome.status === 'applied' ? secondOutcome.slices.instances : undefined;
    expect(
      instancesAfter?.map((instance) => instance.resolvedData.referenceWallClockMs),
      'the second take must carry its own moment, replacing the first clock',
    ).toEqual([momentOfTheLaterTakeInMilliseconds]);
  });
});

describe('takeNext of an item whose clock starts at the take', () => {
  it('stamps the field exactly as takeItem does', () => {
    // Arrange: the same session, with the cursor on the start item.
    const slicesBefore = buildMainSessionWithTheStartItemAndTheRealClockSchema();

    // Act: press Space at 14:47:30.250.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId },
      contextOfTheLaterCommand,
    );

    // Assert: the clock on air counts from the moment Space was pressed.
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(
      instanceOnAir?.resolvedData.referenceWallClockMs,
      'Space must stamp the moment of the press, as the Disparar button does',
    ).toBe(momentOfTheLaterTakeInMilliseconds);
  });
});
