/**
 * Live bound fields follow their source on air (apps/server)
 *
 * What this module is for:
 *   Concept §5.2: while an instance is on air (or in preview), every change of its
 *   source's data is resolved again for its live fields, and what differs is written
 *   through the one command path (refreshBoundInstanceData, signed sistema:vinculos), so
 *   the renderer updates the graphic in place. These tests run that through a real store
 *   and the refresher, polling the seeded simulator by hand.
 *
 * What these tests prove:
 *   - A new flag reaches the clock on air and the clock in preview, each keeping its id.
 *   - A frozen field ("congelado na entrada") stays as it was taken.
 *   - A poll that changes nothing bound leaves no trace: no command, no row.
 *   - Ten routine refreshes write no event-log row.
 *   - The operator's "alterado no ar" list is never touched by a refresh.
 *   - Deleting the item changes nothing on air, and its clock goes on following the
 *     source (the refresh reads the instance's bindings, not the item).
 *   - Deleting the source stops the refreshes and keeps the data on air.
 *   - "Tomar" reads a previewed frozen field again from the newest data.
 *
 * What these tests deliberately do not cover:
 *   - A refresh refused by the graphic's schema and its one row;
 *     liveRefreshRefusals.test.ts.
 *   - The race clock bound whole following a red flag; liveRefreshRaceClock.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  applyOrThrow,
  buildEnduroSession,
  buildSessionBinding,
  createClockItem,
  enduroSimulatorId,
  openStoreWithTheRefresher,
  pollTheSimulatorWithSession,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

describe('the live refresh of bound fields', () => {
  it('raises the yellow flag on the clock on air and on the clock in preview', () => {
    // Arrange: the simulator under green; a clock with its flag bound live on air, and
    // another in preview on the fullscreen layer.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    const fullscreenItemId = createClockItem(stateStore, 'Relógio cheio — fonte', 'fullscreen', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    applyOrThrow(stateStore, { type: 'previewItem', itemId: fullscreenItemId, origin: 'manual' });
    refreshTimer.runThePendingRefresh();
    const clockOnAirBefore = readInstanceOn(stateStore, 'clock', 'program');
    const clockInPreviewBefore = readInstanceOn(stateStore, 'fullscreen', 'preview');

    // Act: the simulator raises the yellow flag, and the refresher runs.
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: 'yellow' }));
    refreshTimer.runThePendingRefresh();

    // Assert: both show yellow, each still the same instance.
    const clockOnAirAfter = readInstanceOn(stateStore, 'clock', 'program');
    const clockInPreviewAfter = readInstanceOn(stateStore, 'fullscreen', 'preview');
    expect(clockOnAirAfter?.resolvedData.state, 'the clock on air must turn yellow').toBe('yellow');
    expect(clockInPreviewAfter?.resolvedData.state, 'the preview must turn yellow').toBe('yellow');
    expect(
      [clockOnAirAfter?.id, clockInPreviewAfter?.id],
      'a refresh updates in place, never replaces',
    ).toEqual([clockOnAirBefore?.id, clockInPreviewBefore?.id]);
  });

  it('keeps a frozen title as it was taken', () => {
    // Arrange: a clock whose title is read from the simulator once, at the take.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — título da fonte', 'clock', {
      sessionName: buildSessionBinding('sessionName', false),
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });

    // Act: the session is renamed and the flag turns yellow.
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ sessionName: 'Enduro — reta final', state: 'yellow' }),
    );
    refreshTimer.runThePendingRefresh();

    // Assert: the live flag followed; the frozen title did not.
    const clockOnAir = readInstanceOn(stateStore, 'clock', 'program');
    expect(clockOnAir?.resolvedData.state, 'the live flag must follow').toBe('yellow');
    expect(clockOnAir?.resolvedData.sessionName, 'the frozen title must stay').toBe(
      'Enduro de Resistência',
    );
  });

  it('leaves no trace when a poll changes nothing the clock shows', () => {
    // Arrange: the bound clock on air.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const slicesBefore = stateStore.readAllSlices();

    // Act: a poll where only the leader's laps moved (not bound on this clock).
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ lapsCompletedByLeader: 35 }));
    refreshTimer.runThePendingRefresh();

    // Assert: the instances are the very same list, and the event log has no new row.
    const slicesAfter = stateStore.readAllSlices();
    expect(slicesAfter.instances, 'nothing on air may change').toBe(slicesBefore.instances);
    expect(slicesAfter.eventLog, 'no row may be written').toEqual(slicesBefore.eventLog);
  });

  it('writes no event-log row over ten routine refreshes', () => {
    // Arrange: the bound clock on air.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const rowsBefore = stateStore.readAllSlices().eventLog.length;

    // Act: ten polls, the flag swinging between yellow and green, each refreshed.
    for (let pollNumber = 1; pollNumber <= 10; pollNumber += 1) {
      const flag = pollNumber % 2 === 1 ? 'yellow' : 'green';
      pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: flag }));
      refreshTimer.runThePendingRefresh();
    }

    // Assert: the flag followed every time, and not one row was written.
    const slicesAfter = stateStore.readAllSlices();
    expect(readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.state, 'green last').toBe(
      'green',
    );
    expect(slicesAfter.eventLog.length, 'routine refreshes must write no row').toBe(rowsBefore);
  });

  it("never marks a field 'alterado no ar' with a refresh", () => {
    // Arrange: the bound clock on air, its typed title changed by the operator on air.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const clockOnAirId = readInstanceOn(stateStore, 'clock', 'program')?.id ?? '';
    applyOrThrow(stateStore, {
      type: 'updateInstanceData',
      instanceId: clockOnAirId,
      data: { sessionName: 'Enduro — última hora' },
    });

    // Act: the flag turns yellow.
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: 'yellow' }));
    refreshTimer.runThePendingRefresh();

    // Assert: only the title the operator changed is listed.
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.fieldsChangedOnAir,
      'a source change is not an operator change',
    ).toEqual(['sessionName']);
  });

  it('goes on following the source after the item is deleted', () => {
    // Arrange: the bound clock on air, then its item deleted.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const clockOnAirBefore = readInstanceOn(stateStore, 'clock', 'program');
    applyOrThrow(stateStore, { type: 'deleteItem', itemId: clockItemId });
    const clockAfterTheDelete = readInstanceOn(stateStore, 'clock', 'program');

    // Act: the flag turns yellow.
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: 'yellow' }));
    refreshTimer.runThePendingRefresh();

    // Assert: the delete changed nothing on air, and the refresh still came.
    expect(clockAfterTheDelete, 'deleting the item must change nothing on air').toEqual(
      clockOnAirBefore,
    );
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.state,
      'the refresh reads the instance, not the item',
    ).toBe('yellow');
  });

  it('stops refreshing and keeps the data on air when the source is deleted', () => {
    // Arrange: the bound clock on air under yellow.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: 'yellow' }));
    const clockItemId = createClockItem(stateStore, 'Relógio — fonte', 'clock', {
      state: buildSessionBinding('state'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const clockOnAirBefore = readInstanceOn(stateStore, 'clock', 'program');

    // Act: the simulator is deleted, and the refresher runs on the change.
    applyOrThrow(stateStore, { type: 'deleteDataSource', sourceId: enduroSimulatorId });
    refreshTimer.runThePendingRefresh();

    // Assert: the clock is still on air exactly as it was (rule 4), and the last row of
    // the event log is the delete, with no refresh after it.
    const slicesAfter = stateStore.readAllSlices();
    expect(readInstanceOn(stateStore, 'clock', 'program'), 'nothing may blank').toEqual(
      clockOnAirBefore,
    );
    expect(slicesAfter.eventLog.at(-1)?.command, 'no refresh after the delete').toBe(
      'deleteDataSource',
    );
  });

  it('reads a previewed frozen title again at "Tomar"', () => {
    // Arrange: a clock with a frozen title previewed, then the session renamed.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — título da fonte', 'clock', {
      sessionName: buildSessionBinding('sessionName', false),
    });
    applyOrThrow(stateStore, { type: 'previewItem', itemId: clockItemId, origin: 'manual' });
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ sessionName: 'Enduro — reta final' }),
    );
    refreshTimer.runThePendingRefresh();
    const titleInPreview = readInstanceOn(stateStore, 'clock', 'preview')?.resolvedData.sessionName;

    // Act: take the preview.
    applyOrThrow(stateStore, { type: 'takePreview', layerId: 'clock' });

    // Assert: the preview kept its title (frozen), the take read the newest one.
    expect(titleInPreview, 'a frozen field in preview is not refreshed').toBe(
      'Enduro de Resistência',
    );
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName,
      'frozen at the take, not at the preview',
    ).toBe('Enduro — reta final');
  });
});
