/**
 * Which new values an instance's live bound fields get (apps/server)
 *
 * What this module is for:
 *   After a source's data changed, the refresher asks buildRefreshOfLiveBoundFields, for
 *   each instance with live bindings, what to send as refreshBoundInstanceData. It reads
 *   only the instance's own entry of `instanceBindings` (never the item) and the sources.
 *   Its rules for a field that cannot be read now differ from a take's, because the
 *   graphic is already on air and nothing on air is ever blanked by a failure (rule 4):
 *   a required field whose value is gone keeps its last good value, a source deleted or
 *   with no data keeps every value, and only an optional field whose value the source no
 *   longer has leaves the air (sent as null).
 *
 * What these tests prove:
 *   - A new flag is sent with every live value; a frozen field is never read.
 *   - Nothing is sent when every live value equals what is on air.
 *   - Only the fields bound to a source that changed are read, when the changed sources
 *     are named.
 *   - The whole clock is sent as its four fields together.
 *   - An optional field whose value is gone is sent as null; a required one keeps its
 *     value; a deleted source keeps everything (nothing is sent).
 *
 * What these tests deliberately do not cover:
 *   - What the store does with the refresh; refreshBoundInstanceData.test.ts and
 *     liveRefreshThroughTheStore.test.ts.
 */
import type {
  DataSnapshot,
  Graphic,
  Instance,
  InstanceBoundField,
  SourcesForBindings,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../../core/store/builtGraphicsFolder.testSupport.js';
import {
  buildLiveBindingToTheSimulatorSession,
  buildSimulatorSourceThatIsOn,
  readSimulatorSnapshotAtLap34,
  simulatorSourceId,
} from '../../core/store/reducers/boundItemSlices.testSupport.js';
import { buildEmptyLibrary } from '../../core/store/resolveItemFieldsWithEntities.testSupport.js';
import { buildRefreshOfLiveBoundFields } from './liveFieldsRefresh.js';

/** The race clock with its real data schema. */
function buildRaceClockGraphic(): Graphic {
  return {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The bound clock on air as the lap-34 green snapshot put it there. */
function buildBoundClockOnAir(): Instance {
  return {
    id: 'relogio-no-ar',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'remaining',
      referenceTimeMs: 4_559_052,
      referenceWallClockMs: 1_805_568_240_948,
      running: true,
      lapsCompletedByLeader: 34,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:30:00.000Z',
    itemId: 'c3d9f1a7-2b4e-4f60-8a1c-5e7d9b3f0a26',
  };
}

/** The bound fields of that clock: flag and laps live, whole clock live, title frozen. */
function buildBoundFieldsOfTheClock(): InstanceBoundField[] {
  return [
    { fieldKey: 'state', binding: buildLiveBindingToTheSimulatorSession('state') },
    {
      fieldKey: 'lapsCompletedByLeader',
      binding: buildLiveBindingToTheSimulatorSession('lapsCompletedByLeader'),
    },
    { fieldKey: 'referenceTimeMs', binding: buildLiveBindingToTheSimulatorSession('clock') },
    {
      fieldKey: 'sessionName',
      binding: { ...buildLiveBindingToTheSimulatorSession('sessionName'), isLive: false },
    },
  ];
}

/** The simulator with the snapshot given. */
function buildSourcesWithSnapshot(snapshot: DataSnapshot): SourcesForBindings {
  return {
    dataSources: [buildSimulatorSourceThatIsOn()],
    dataSnapshots: [snapshot],
    overrides: [],
    bracketMatchFocuses: [],
  };
}

/** The lap-34 snapshot with the session changed as given. */
function readSnapshotWithSession(changes: Record<string, unknown>): DataSnapshot {
  const snapshot = readSimulatorSnapshotAtLap34();
  const session = snapshot.shapes.session;
  return {
    ...snapshot,
    shapes: { ...snapshot.shapes, session: { ...session, ...changes } as typeof session },
  };
}

/** Asks what to send for the bound clock, against the sources given. */
function buildRefreshOfTheClock(
  sources: SourcesForBindings,
  sourceIdsThatChanged?: ReadonlySet<string>,
) {
  return buildRefreshOfLiveBoundFields({
    instance: buildBoundClockOnAir(),
    boundFields: buildBoundFieldsOfTheClock(),
    graphic: buildRaceClockGraphic(),
    sources,
    sourceIdsThatChanged,
    entityFields: [],
    entities: buildEmptyLibrary(),
    haveEntitiesChanged: false,
  });
}

describe('buildRefreshOfLiveBoundFields', () => {
  it('sends every live value when the flag turned yellow, and never the frozen title', () => {
    // Arrange: the next poll raised the yellow flag and renamed the session.
    const sources = buildSourcesWithSnapshot(
      readSnapshotWithSession({ state: 'yellow', sessionName: 'Enduro — reta final' }),
    );

    // Act: ask what to send.
    const refresh = buildRefreshOfTheClock(sources);

    // Assert: the live values, the yellow among them; the frozen title is not read.
    expect(refresh, 'every live value, and no frozen one').toEqual({
      state: 'yellow',
      lapsCompletedByLeader: 34,
      referenceTimeMs: 4_559_052,
      referenceWallClockMs: 1_805_568_240_948,
      running: true,
      clockMode: 'remaining',
    });
  });

  it('sends nothing when every live value is what is on air', () => {
    // Arrange: the same snapshot the clock was taken from.
    const sources = buildSourcesWithSnapshot(readSimulatorSnapshotAtLap34());

    // Act: ask what to send.
    const refresh = buildRefreshOfTheClock(sources);

    // Assert: nothing to send.
    expect(refresh, 'an unchanged source must send nothing').toBeUndefined();
  });

  it('reads nothing when the source that changed is another one', () => {
    // Arrange: the yellow flag, but the change came from another source.
    const sources = buildSourcesWithSnapshot(readSnapshotWithSession({ state: 'yellow' }));

    // Act: ask what to send for a change of the timing system only.
    const refresh = buildRefreshOfTheClock(sources, new Set(['cronometragem']));

    // Assert: nothing; the clock reads the simulator only.
    expect(refresh, 'a change of another source must send nothing').toBeUndefined();
  });

  it('sends the whole clock as its four fields together when the red flag stops it', () => {
    // Arrange: a red flag; the simulator stopped its clock a poll later.
    const stoppedClock = {
      clockMode: 'remaining',
      referenceTimeMs: 4_558_000,
      referenceWallClockMs: 1_805_568_242_948,
      running: false,
    };
    const sources = buildSourcesWithSnapshot(
      readSnapshotWithSession({ state: 'red', clock: stoppedClock }),
    );

    // Act: ask what to send, for a change of the simulator.
    const refresh = buildRefreshOfTheClock(sources, new Set([simulatorSourceId]));

    // Assert: the four clock fields of the one reading, never some of them.
    expect(refresh, 'the clock must move as one reading').toMatchObject({
      state: 'red',
      ...stoppedClock,
    });
  });

  it("takes the leader's laps off air when the source no longer has them", () => {
    // Arrange: a session without the leader's laps (optional on the race clock).
    const snapshot = readSimulatorSnapshotAtLap34();
    const session = { ...snapshot.shapes.session } as Record<string, unknown>;
    delete session.lapsCompletedByLeader;
    const sources = buildSourcesWithSnapshot({
      ...snapshot,
      shapes: { ...snapshot.shapes, session: session as typeof snapshot.shapes.session },
    });

    // Act: ask what to send.
    const refresh = buildRefreshOfTheClock(sources);

    // Assert: the laps sent as null, which takes an optional field off air.
    expect(refresh, 'the laps must leave the air').toMatchObject({ lapsCompletedByLeader: null });
  });

  it('keeps every value on air when the source was deleted', () => {
    // Arrange: no source at all any more.
    const sources: SourcesForBindings = { dataSources: [], dataSnapshots: [], overrides: [], bracketMatchFocuses: [] };

    // Act: ask what to send.
    const refresh = buildRefreshOfTheClock(sources);

    // Assert: nothing sent; what is on air stays (rule 4).
    expect(refresh, 'a deleted source must blank nothing').toBeUndefined();
  });

  it('keeps the last good flag when a required value is gone', () => {
    // Arrange: a binding of the flag to the 1st place's gap, which the leader never has.
    const boundFields: InstanceBoundField[] = [
      {
        fieldKey: 'state',
        binding: {
          kind: 'binding',
          sourceId: simulatorSourceId,
          shapeKey: 'positions',
          path: 'entries.0.gapToLeaderMs',
          isLive: true,
        },
      },
    ];

    // Act: ask what to send.
    const refresh = buildRefreshOfLiveBoundFields({
      instance: buildBoundClockOnAir(),
      boundFields,
      graphic: buildRaceClockGraphic(),
      sources: buildSourcesWithSnapshot(readSimulatorSnapshotAtLap34()),
      sourceIdsThatChanged: undefined,
      entityFields: [],
      entities: buildEmptyLibrary(),
      haveEntitiesChanged: false,
    });

    // Assert: nothing; a required field keeps its value instead of leaving the air.
    expect(refresh, 'a required field must keep its last good value').toBeUndefined();
  });
});
