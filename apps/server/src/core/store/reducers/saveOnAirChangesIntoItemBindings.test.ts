/**
 * "Salvar no item" never replaces a binding (apps/server)
 *
 * What this module is for:
 *   saveOnAirChangesIntoItem writes into the item what the operator changed on air. On
 *   an item that reads fields from a source, a field changed on air may be one the item
 *   reads ("Fonte", or the whole clock): writing the value on air over its binding would
 *   quietly stop it following the source at every later take. Gate 2 of PR #18 made the
 *   save skip those fields; the control page names them to the operator.
 *
 * What these tests prove:
 *   - A typed title and a flag the item reads from the source, both changed on air: the
 *     title is saved, the flag keeps its binding and stays listed as changed on air.
 *   - A stopped clock whose item reads the whole clock: nothing is saved, and the item
 *     keeps its whole-clock binding.
 *
 * What these tests deliberately do not cover:
 *   - The save of typed fields and the clock saved whole; saveOnAirChangesIntoItem*.test.ts.
 *   - Which keys an item reads from a source; itemFieldsReadFromASource.test.ts in
 *     packages/shared.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockFieldsBoundToTheSimulator,
  buildEnduroClockItemBoundToTheSimulator,
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

/** The bound clock (typed title, live flag and whole clock) on air, then edited on air. */
function buildBoundClockEditedOnAir(data: Record<string, unknown>): SlicesChangedByCommands {
  const slicesBeforeTheTake = buildRaceDaySlicesWithTheSimulator({
    items: [buildEnduroClockItemBoundToTheSimulator(0)],
    dataSnapshots: [readSimulatorSnapshotAtLap34()],
  });
  const slicesOnAir = applyAndReadSlices(slicesBeforeTheTake, {
    type: 'takeItem',
    itemId: boundClockItemId,
  });
  return applyAndReadSlices(slicesOnAir, {
    type: 'updateInstanceData',
    instanceId: instanceOnAirId,
    data,
    takeTimeFieldKeys: [],
  });
}

const saveIntoTheItem: Command = {
  type: 'saveOnAirChangesIntoItem',
  instanceId: instanceOnAirId,
  wallClockFields: 'keepMoment',
};

describe('"Salvar no item" on an item that reads a source', () => {
  it('saves the typed title and keeps the flag binding', () => {
    // Arrange: on air, the title retyped and the flag set to red by hand.
    const slicesBefore = buildBoundClockEditedOnAir({
      sessionName: 'Enduro — Etapa Nacional',
      state: 'red',
    });

    // Act: "Salvar no item".
    const slicesAfter = applyAndReadSlices(slicesBefore, saveIntoTheItem);

    // Assert: the title is a literal now; the flag still reads the source and is still
    // listed as changed on air (the item would give the source's flag).
    expect(slicesAfter.items[0]?.fields, 'only the typed title may be saved').toEqual({
      ...buildEnduroClockFieldsBoundToTheSimulator(),
      sessionName: { kind: 'literal', value: 'Enduro — Etapa Nacional' },
    });
    expect(slicesAfter.instances[0]?.fieldsChangedOnAir, 'the flag stays changed on air').toEqual([
      'state',
    ]);
  });

  it('saves nothing of a stopped clock the item reads whole from the source', () => {
    // Arrange: on air, the clock stopped by hand.
    const slicesBefore = buildBoundClockEditedOnAir({ running: false });

    // Act: "Salvar no item".
    const slicesAfter = applyAndReadSlices(slicesBefore, saveIntoTheItem);

    // Assert: the item still reads the whole clock from the simulator.
    expect(slicesAfter.items[0]?.fields, 'the whole clock binding must stay').toEqual(
      buildEnduroClockFieldsBoundToTheSimulator(),
    );
  });
});
