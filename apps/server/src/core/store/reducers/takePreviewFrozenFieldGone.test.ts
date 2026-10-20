/**
 * "Tomar" with a frozen field the source no longer sends (apps/server)
 *
 * What this module is for:
 *   A frozen bound field is frozen at the take, not at the preview: takePreview reads it
 *   again from the newest snapshot. When the source no longer sends an optional value, a
 *   take leaves that field out (an absent optional value goes off air). Gate 2 of PR #18
 *   found takePreview keeping the preview's old value instead, because the fields read
 *   again were laid over the preview's data: a field read as absent was simply not there
 *   to replace it.
 *
 * What these tests prove:
 *   - The leader's laps, frozen and previewed as 34, are not on program after a poll
 *     that no longer sends them, while the rest of the preview goes on air as seen.
 *
 * What these tests deliberately do not cover:
 *   - A frozen field read again with a new value; instanceBindingsAtTheTake.test.ts.
 *   - A required field the source no longer sends: the take is refused, as any take;
 *     resolveItemFieldsWithBindings.test.ts.
 */
import type { DataSnapshot } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockItemBoundToTheSimulator,
  buildLiveBindingToTheSimulatorSession,
  buildRaceDaySlicesWithTheSimulator,
  readSimulatorSnapshotAtLap34,
} from './boundItemSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import { contextOfTheRundownCommand } from './rundownSlices.testSupport.js';

/** Applies a command and hands back the new slices, failing the test when it is refused. */
function applyAndReadSlices(
  slices: SlicesChangedByCommands,
  command: Parameters<typeof reduceCommand>[1],
  context: ReducerContext,
): SlicesChangedByCommands {
  const outcome = reduceCommand(slices, command, context);
  if (outcome.status === 'refused') {
    throw new Error(`refused: ${outcome.error.message}`);
  }
  return outcome.slices;
}

/** The lap-34 snapshot whose session no longer says how many laps the leader made. */
function readSnapshotWithoutTheLeadersLaps(): DataSnapshot {
  const snapshot = readSimulatorSnapshotAtLap34();
  const session = snapshot.shapes.session;
  if (session === undefined) {
    return snapshot;
  }
  const sessionWithoutTheLaps = { ...session };
  delete sessionWithoutTheLaps.lapsCompletedByLeader;
  return { ...snapshot, shapes: { ...snapshot.shapes, session: sessionWithoutTheLaps } };
}

describe('takePreview with a frozen field the source no longer sends', () => {
  it("takes the leader's laps off air and keeps the rest as previewed", () => {
    // Arrange: the bound clock with the leader's laps frozen at the take, previewed at
    // lap 34; then a poll whose session no longer sends the laps.
    const boundClockItem = buildEnduroClockItemBoundToTheSimulator(0);
    const itemWithFrozenLaps = {
      ...boundClockItem,
      fields: {
        ...boundClockItem.fields,
        lapsCompletedByLeader: {
          ...buildLiveBindingToTheSimulatorSession('lapsCompletedByLeader'),
          isLive: false,
        },
      },
    };
    const previewed = applyAndReadSlices(
      buildRaceDaySlicesWithTheSimulator({
        items: [itemWithFrozenLaps],
        dataSnapshots: [readSimulatorSnapshotAtLap34()],
      }),
      { type: 'previewItem', itemId: itemWithFrozenLaps.id, origin: 'manual' },
      contextOfTheRundownCommand,
    );
    const lapsInPreview = previewed.instances[0]?.resolvedData.lapsCompletedByLeader;
    const afterTheNextPoll = {
      ...previewed,
      dataSnapshots: [readSnapshotWithoutTheLeadersLaps()],
    };

    // Act: take the preview.
    const slicesAfter = applyAndReadSlices(
      afterTheNextPoll,
      { type: 'takePreview', layerId: 'clock' },
      { ...contextOfTheRundownCommand, newInstanceId: 'instancia-tomada' },
    );

    // Assert: the laps were in the preview and are not on program; the title is too.
    const programInstance = slicesAfter.instances.find(
      (instance) => instance.id === 'instancia-tomada',
    );
    expect(lapsInPreview, 'the preview showed the laps').toBe(34);
    expect(
      programInstance?.resolvedData,
      'an absent optional value goes off air at the take',
    ).not.toHaveProperty('lapsCompletedByLeader');
    expect(programInstance?.resolvedData.sessionName, 'the rest goes on as previewed').toBe(
      'Enduro de Resistência',
    );
  });
});
