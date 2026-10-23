/**
 * The slices one state change changed, and how a client lays them over what it had (packages/shared)
 *
 * What this module is for:
 *   One command can change several slices at once ("Prévia: limpar" on a previewed layer
 *   removes the preview from `instances` and adds the marker to `previewClearedLayerIds`,
 *   and every accepted command adds a line to `eventLog`). The server sends those slices
 *   together, as a part of Slices (ChangedSlicesSchema), so a client takes them in one
 *   step. mergeChangedSlicesIntoSlices is that step, shared by the renderer and the
 *   control page.
 *
 * What these tests prove:
 *   - ChangedSlicesSchema checks each slice it carries with that slice's own schema, so
 *     layers sent under `instances` are refused, and refuses a name that is not a slice,
 *     `dataSnapshots` (sent source by source since BAJAOVRLAY-40) and a group that
 *     carries no slice at all.
 *   - mergeChangedSlicesIntoSlices replaces exactly the slices it was given, all of them,
 *     and keeps every other slice as the very same list.
 *
 * What these tests deliberately do not cover:
 *   - The `slices` message that carries a group; serverMessages.slicesMessage.test.ts.
 *   - When the server sends a group instead of a single `slice`; apps/server's
 *     webSocketHub tests.
 */
import { describe, expect, it } from 'vitest';

import { ChangedSlicesSchema, mergeChangedSlicesIntoSlices } from './changedSlices.js';
import type { Slices } from './slices.js';

const clockLayer = {
  id: 'clock',
  name: 'Relógio',
  zIndex: 30,
  replacePolicy: 'out-then-in',
  persistent: true,
} as const;

const enduroClockOnAir = {
  id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
  layerId: 'clock',
  graphicId: 'race-clock',
  target: 'program',
  resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
  currentStep: 0,
  status: 'on-air',
  takenAt: '2026-10-09T13:00:00.000Z',
} as const;

const finalClockInPreview = {
  ...enduroClockOnAir,
  id: '0b6e2f4a-91c3-4d7e-8a25-6f1c3e9b7d40',
  target: 'preview',
  resolvedData: { sessionName: 'Final', state: 'green' },
} as const;

/** Builds every slice as a client holds them: the clock layer, and the given instances. */
function createSlicesWithClockLayerAndInstances(instances: Slices['instances']): Slices {
  return {
    layers: [clockLayer],
    graphics: [],
    instances,
    previewClearedLayerIds: [],
    instanceBindings: [],
    overrides: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
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

describe('ChangedSlicesSchema', () => {
  const changedSlicesScenarios = [
    // What "Prévia: limpar" on a previewed layer changes: the preview goes, the marker comes.
    {
      name: 'accepts the instances and the markers changed by one command',
      changedSlices: { instances: [enduroClockOnAir], previewClearedLayerIds: ['clock'] },
      isAccepted: true,
    },
    // One slice alone is still a part of Slices; the server sends it as `slice`, but a
    // group of one must not be a reason to refuse anything.
    {
      name: 'accepts a group that carries one slice',
      changedSlices: { previewClearedLayerIds: ['clock'] },
      isAccepted: true,
    },
    // Each value is checked by its own slice's schema: layers are not instances.
    {
      name: 'refuses layers sent as the instances slice',
      changedSlices: { instances: [clockLayer], previewClearedLayerIds: ['clock'] },
      isAccepted: false,
    },
    // A misspelt slice name would otherwise be dropped silently and the change lost.
    {
      name: 'refuses a name that is not a slice',
      changedSlices: { instancias: [enduroClockOnAir], previewClearedLayerIds: ['clock'] },
      isAccepted: false,
    },
    // The snapshots go source by source in a `dataSnapshot` message (BAJAOVRLAY-40); a
    // group carrying the whole list would resend every source's data on every poll.
    {
      name: 'refuses the dataSnapshots slice, which is never sent whole after the hello',
      changedSlices: { dataSnapshots: [], previewClearedLayerIds: ['clock'] },
      isAccepted: false,
    },
    // A group that changes nothing is a server bug, not a state change.
    {
      name: 'refuses a group that carries no slice',
      changedSlices: {},
      isAccepted: false,
    },
  ];

  it.each(changedSlicesScenarios)('$name', ({ changedSlices, isAccepted }) => {
    // Arrange: a group of changed slices (from the table above).
    const groupOfChangedSlices = changedSlices;

    // Act: check the group.
    const result = ChangedSlicesSchema.safeParse(groupOfChangedSlices);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the group of changed slices must be judged as the row says').toBe(
      isAccepted,
    );
  });
});

describe('mergeChangedSlicesIntoSlices', () => {
  it('replaces every slice of the group at once and keeps the others as they were', () => {
    // Arrange: the enduro clock on air with the final clock previewed over it, and the
    // group "Prévia: limpar" on the clock layer makes: the preview gone, the layer marked.
    const slicesBefore = createSlicesWithClockLayerAndInstances([
      enduroClockOnAir,
      finalClockInPreview,
    ]);
    const changedSlices = ChangedSlicesSchema.parse({
      instances: [enduroClockOnAir],
      previewClearedLayerIds: ['clock'],
    });

    // Act: lay the group over the slices.
    const slicesAfter = mergeChangedSlicesIntoSlices(slicesBefore, changedSlices);

    // Assert: both changed slices are the new ones, and every other slice is the very
    // same list as before (so nothing that reads it redraws for nothing).
    expect(slicesAfter, 'both slices of the group must be replaced together').toEqual({
      ...slicesBefore,
      instances: [enduroClockOnAir],
      previewClearedLayerIds: ['clock'],
    });
    expect(slicesAfter.layers, 'a slice the group does not carry must be kept as is').toBe(
      slicesBefore.layers,
    );
    expect(slicesAfter.eventLog, 'a slice the group does not carry must be kept as is').toBe(
      slicesBefore.eventLog,
    );
  });
});
