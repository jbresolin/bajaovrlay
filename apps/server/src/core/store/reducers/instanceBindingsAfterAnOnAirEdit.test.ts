/**
 * An operator's edit on air releases the live bindings it types over (apps/server)
 *
 * What this module is for:
 *   A bound item on air keeps following its source: every new poll sends
 *   refreshBoundInstanceData for its live fields, read from `instanceBindings`. When the
 *   operator then types a value into one of those fields on air ("Atualizar no ar" after
 *   switching the field from "Fonte" to a typed value), the next refresh must not put the
 *   source's value back. Gate 2 of PR #18 chose to update `instanceBindings` for that
 *   instance: updateInstanceData drops the live binding of every field it sends, so what
 *   the operator typed stays on air until the next take, which reads the item again.
 *
 * What these tests prove:
 *   - Typing the flag drops the flag's live binding and keeps the whole clock's.
 *   - Typing any one of the four clock fields drops the whole clock's binding: the clock
 *     is refreshed as one reading, so it cannot keep following with one field typed.
 *   - Typing every bound field drops the instance's entry altogether.
 *   - An edit that changes nothing on air releases nothing.
 *
 * What these tests deliberately do not cover:
 *   - The refresh itself skipping a released field; it reads only the entry
 *     (liveRefresher tests).
 *   - What the item editor sends; useItemEditorSaves and itemFieldsFromSchemaForm tests.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockItemBoundToTheSimulator,
  buildLiveBindingToTheSimulatorSession,
  buildRaceDaySlicesWithTheSimulator,
  readSimulatorSnapshotAtLap34,
} from './boundItemSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import { contextOfTheRundownCommand } from './rundownSlices.testSupport.js';

const boundClockItemId = buildEnduroClockItemBoundToTheSimulator(0).id;
const instanceOnAirId = contextOfTheRundownCommand.newInstanceId;

/** Applies a command and hands back the new slices, failing the test when it is refused. */
function applyAndReadSlices(
  slices: SlicesChangedByCommands,
  command: Command,
): SlicesChangedByCommands {
  const outcome = reduceCommand(slices, command, contextOfTheRundownCommand);
  if (outcome.status === 'refused') {
    throw new Error(`refused: ${outcome.error.message}`);
  }
  return outcome.slices;
}

/** The bound clock (flag and whole clock live) taken at lap 34 of the simulator. */
function buildRaceDayWithTheBoundClockOnAir(): SlicesChangedByCommands {
  const slicesBeforeTheTake = buildRaceDaySlicesWithTheSimulator({
    items: [buildEnduroClockItemBoundToTheSimulator(0)],
    dataSnapshots: [readSimulatorSnapshotAtLap34()],
  });
  return applyAndReadSlices(slicesBeforeTheTake, { type: 'takeItem', itemId: boundClockItemId });
}

/** The operator's "Atualizar no ar" with these fields. */
function buildOperatorUpdate(data: Record<string, unknown>): Command {
  return { type: 'updateInstanceData', instanceId: instanceOnAirId, data, takeTimeFieldKeys: [] };
}

describe('instanceBindings after an operator edits a bound instance on air', () => {
  it("drops the flag's live binding when the flag is typed, and keeps the clock's", () => {
    // Arrange: the bound clock on air, following the simulator's flag and clock.
    const slicesBefore = buildRaceDayWithTheBoundClockOnAir();

    // Act: the operator types a red flag on air.
    const slicesAfter = applyAndReadSlices(slicesBefore, buildOperatorUpdate({ state: 'red' }));

    // Assert: the red flag is on air, and only the clock still follows the source.
    expect(slicesAfter.instances[0]?.resolvedData.state, 'the typed flag must be on air').toBe(
      'red',
    );
    expect(slicesAfter.instanceBindings, 'only the whole clock may stay live').toEqual([
      {
        instanceId: instanceOnAirId,
        boundFields: [
          { fieldKey: 'referenceTimeMs', binding: buildLiveBindingToTheSimulatorSession('clock') },
        ],
      },
    ]);
  });

  it("drops the whole clock's binding when one clock field is typed", () => {
    // Arrange: the bound clock on air.
    const slicesBefore = buildRaceDayWithTheBoundClockOnAir();

    // Act: the operator stops the clock on air (one of the four clock fields).
    const slicesAfter = applyAndReadSlices(slicesBefore, buildOperatorUpdate({ running: false }));

    // Assert: the flag still follows the source; the clock no longer does.
    expect(
      slicesAfter.instanceBindings[0]?.boundFields.map((boundField) => boundField.fieldKey),
      'a clock with one typed field cannot follow the source as one reading',
    ).toEqual(['state']);
  });

  it('drops the entry when every bound field is typed', () => {
    // Arrange: the bound clock on air.
    const slicesBefore = buildRaceDayWithTheBoundClockOnAir();

    // Act: the operator types the flag and a new time for the clock.
    const slicesAfter = applyAndReadSlices(
      slicesBefore,
      buildOperatorUpdate({ state: 'yellow', referenceTimeMs: 3_600_000 }),
    );

    // Assert: nothing of this instance follows the source any more.
    expect(slicesAfter.instanceBindings, 'no entry may be left for this instance').toEqual([]);
  });

  it('releases nothing when the edit leaves the air as it is', () => {
    // Arrange: the bound clock on air, its flag green from the source.
    const slicesBefore = buildRaceDayWithTheBoundClockOnAir();

    // Act: "Atualizar no ar" sends the green flag that is already on air.
    const slicesAfter = applyAndReadSlices(slicesBefore, buildOperatorUpdate({ state: 'green' }));

    // Assert: the very same slices, the flag still live.
    expect(slicesAfter, 'an edit that changes nothing must change nothing').toBe(slicesBefore);
  });
});
