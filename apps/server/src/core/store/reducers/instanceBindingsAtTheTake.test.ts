/**
 * The bindings an instance keeps from its take (apps/server)
 *
 * What this module is for:
 *   When a bound item goes on air or into preview, the server writes down, in the slice
 *   `instanceBindings` keyed by the new instance's id, which of its fields were read from
 *   a source and how (field key plus binding). Live refreshes read that slice, never the
 *   item, so editing or deleting the item does not change what is on air, as with the
 *   rest of the instance. A program instance keeps its live bindings only; a preview also
 *   keeps its frozen ones, because a frozen field in a preview is read again at
 *   "Tomar" (takePreview): frozen at the take, not at the preview, as takeTime fields are.
 *   An entry leaves with its instance (clear, replace, promote).
 *
 * What these tests prove:
 *   - takeItem records the live bindings of the new program instance (the flag and the
 *     whole clock) and not the frozen title, and the instance shows the snapshot's data.
 *   - previewItem records the frozen binding as well.
 *   - takePreview reads the frozen title again from the newest snapshot, keeps the
 *     previewed live values, moves the live bindings to the new program instance and
 *     drops the preview's entry.
 *   - A clear drops the instance's entry, and so does a take that replaces it.
 *   - An item with no binding leaves the slice exactly as it was.
 *   - A bound item whose source has no data yet is refused and nothing changes.
 *
 * What these tests deliberately do not cover:
 *   - Reading each binding; resolveItemFieldsWithBindings.test.ts.
 *   - Keeping the slice across a restart and away from the screens; the store and
 *     WebSocket tests (storeInstanceBindings.test.ts, webSocketHubScreenSlices.test.ts).
 */
import type { DataSnapshot, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockItemBoundToTheSimulator,
  buildLiveBindingToTheSimulatorSession,
  buildRaceDaySlicesWithTheSimulator,
  readSimulatorSnapshotAtLap34,
} from './boundItemSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import { buildEnduroStartItem, contextOfTheRundownCommand } from './rundownSlices.testSupport.js';

/** The bound clock with its title read from the simulator too, frozen at the take. */
function buildFieldsWithAFrozenTitle(): ItemFields {
  return {
    ...buildEnduroClockItemBoundToTheSimulator(0).fields,
    sessionName: { ...buildLiveBindingToTheSimulatorSession('sessionName'), isLive: false },
  };
}

/** A race day with the bound clock (frozen title) in the rundown and the lap-34 snapshot. */
function buildRaceDayWithTheBoundClock(): SlicesChangedByCommands {
  return buildRaceDaySlicesWithTheSimulator({
    items: [
      { ...buildEnduroClockItemBoundToTheSimulator(0), fields: buildFieldsWithAFrozenTitle() },
    ],
    dataSnapshots: [readSimulatorSnapshotAtLap34()],
  });
}

/** Applies a command and hands back the new slices, failing the test when it is refused. */
function applyAndReadSlices(
  slices: SlicesChangedByCommands,
  command: Parameters<typeof reduceCommand>[1],
  context: ReducerContext = contextOfTheRundownCommand,
): SlicesChangedByCommands {
  const outcome = reduceCommand(slices, command, context);
  if (outcome.status === 'refused') {
    throw new Error(`refused: ${outcome.error.message}`);
  }
  return outcome.slices;
}

/** The lap-34 snapshot with the session renamed, as a later poll might send it. */
function readSnapshotWithTheSessionRenamed(): DataSnapshot {
  const snapshot = readSimulatorSnapshotAtLap34('session.enduro-yellow.json');
  const session = snapshot.shapes.session;
  if (session === undefined) {
    return snapshot;
  }
  return {
    ...snapshot,
    shapes: { ...snapshot.shapes, session: { ...session, sessionName: 'Enduro — reta final' } },
  };
}

const boundClockItemId = buildEnduroClockItemBoundToTheSimulator(0).id;

describe('instanceBindings at the take', () => {
  it('records the live bindings of the new program instance, not the frozen title', () => {
    // Arrange: the bound clock in the rundown, the simulator at lap 34.
    const slicesBefore = buildRaceDayWithTheBoundClock();

    // Act: take it.
    const slicesAfter = applyAndReadSlices(slicesBefore, {
      type: 'takeItem',
      itemId: boundClockItemId,
    });

    // Assert: the flag and the whole clock are written down for the new instance, the
    // title (frozen) is not, and the instance shows what the snapshot says.
    expect(slicesAfter.instanceBindings, 'only the live bindings must be recorded').toEqual([
      {
        instanceId: contextOfTheRundownCommand.newInstanceId,
        boundFields: [
          { fieldKey: 'state', binding: buildLiveBindingToTheSimulatorSession('state') },
          { fieldKey: 'referenceTimeMs', binding: buildLiveBindingToTheSimulatorSession('clock') },
        ],
      },
    ]);
    expect(slicesAfter.instances[0]?.resolvedData, 'the instance must show the snapshot').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'green',
      referenceTimeMs: 4_559_052,
      referenceWallClockMs: 1_805_568_240_948,
      running: true,
      clockMode: 'remaining',
    });
  });

  it('records the frozen binding of a preview too, for "Tomar" to read again', () => {
    // Arrange: the bound clock in the rundown.
    const slicesBefore = buildRaceDayWithTheBoundClock();

    // Act: preview it.
    const slicesAfter = applyAndReadSlices(slicesBefore, {
      type: 'previewItem',
      itemId: boundClockItemId,
      origin: 'manual',
    });

    // Assert: the frozen title is kept beside the live ones.
    expect(
      slicesAfter.instanceBindings[0]?.boundFields.map((boundField) => boundField.fieldKey),
      'a preview must keep its frozen bindings too',
    ).toEqual(['sessionName', 'state', 'referenceTimeMs']);
  });

  it('reads the frozen title again at "Tomar" and moves only the live bindings to program', () => {
    // Arrange: the bound clock previewed at lap 34, then a poll that renamed the session
    // and raised the yellow flag.
    const previewed = applyAndReadSlices(buildRaceDayWithTheBoundClock(), {
      type: 'previewItem',
      itemId: boundClockItemId,
      origin: 'manual',
    });
    const previewInstanceId = contextOfTheRundownCommand.newInstanceId;
    const afterTheNextPoll = { ...previewed, dataSnapshots: [readSnapshotWithTheSessionRenamed()] };
    const contextOfTheTake = { ...contextOfTheRundownCommand, newInstanceId: 'instancia-tomada' };

    // Act: take the preview.
    const slicesAfter = applyAndReadSlices(
      afterTheNextPoll,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheTake,
    );

    // Assert: the title is the newest one (frozen at the take, not at the preview), the
    // flag is still what was previewed (live fields follow the refreshes, not the take),
    // and the program instance carries the live bindings while the preview's are gone.
    const programInstance = slicesAfter.instances.find(
      (instance) => instance.id === 'instancia-tomada',
    );
    expect(programInstance?.resolvedData.sessionName, 'the frozen title is read at the take').toBe(
      'Enduro — reta final',
    );
    expect(programInstance?.resolvedData.state, 'a live field keeps what was previewed').toBe(
      'green',
    );
    expect(slicesAfter.instanceBindings, 'only the program entry, live bindings only').toEqual([
      {
        instanceId: 'instancia-tomada',
        boundFields: [
          { fieldKey: 'state', binding: buildLiveBindingToTheSimulatorSession('state') },
          { fieldKey: 'referenceTimeMs', binding: buildLiveBindingToTheSimulatorSession('clock') },
        ],
      },
    ]);
    expect(
      slicesAfter.instanceBindings.some((entry) => entry.instanceId === previewInstanceId),
      'the preview entry must leave with the preview',
    ).toBe(false);
  });

  it('drops the entry when the layer is cleared', () => {
    // Arrange: the bound clock on air.
    const onAir = applyAndReadSlices(buildRaceDayWithTheBoundClock(), {
      type: 'takeItem',
      itemId: boundClockItemId,
    });

    // Act: clear the clock layer.
    const slicesAfter = applyAndReadSlices(onAir, { type: 'clearLayer', layerId: 'clock' });

    // Assert: nothing left to refresh.
    expect(slicesAfter.instanceBindings, 'the entry must leave with its instance').toEqual([]);
  });

  it('drops the entry when another take replaces the instance', () => {
    // Arrange: the bound clock on air, and a typed clock item beside it in the rundown.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({
      items: [buildEnduroClockItemBoundToTheSimulator(0), buildEnduroStartItem(1)],
      dataSnapshots: [readSimulatorSnapshotAtLap34()],
    });
    const onAir = applyAndReadSlices(slicesBefore, { type: 'takeItem', itemId: boundClockItemId });

    // Act: take the typed clock on the same layer.
    const slicesAfter = applyAndReadSlices(
      onAir,
      { type: 'takeItem', itemId: buildEnduroStartItem(1).id },
      { ...contextOfTheRundownCommand, newInstanceId: 'relogio-digitado' },
    );

    // Assert: the replaced instance's bindings are gone, and the typed clock has none.
    expect(slicesAfter.instanceBindings, 'a replaced instance must leave no entry').toEqual([]);
  });

  it('leaves the slice as it was for an item with no binding', () => {
    // Arrange: a race day with only the typed clock.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [buildEnduroStartItem(0)] });

    // Act: take it.
    const slicesAfter = applyAndReadSlices(slicesBefore, {
      type: 'takeItem',
      itemId: buildEnduroStartItem(0).id,
    });

    // Assert: the very same list, so nothing about it is saved or broadcast.
    expect(slicesAfter.instanceBindings, 'the slice must not be rewritten').toBe(
      slicesBefore.instanceBindings,
    );
  });

  it('refuses a bound item whose source has no data yet, and changes nothing', () => {
    // Arrange: the bound clock, the simulator on but not polled yet.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({
      items: [buildEnduroClockItemBoundToTheSimulator(0)],
    });

    // Act: take it.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: boundClockItemId },
      contextOfTheRundownCommand,
    );

    // Assert: refused, naming the field and the source.
    expect(outcome, 'a source with no data must refuse the take').toEqual({
      status: 'refused',
      error: {
        code: 'BINDING_NOT_RESOLVED',
        message: 'Bandeira: a fonte Simulador — Enduro ainda não tem dados.',
      },
    });
  });
});
