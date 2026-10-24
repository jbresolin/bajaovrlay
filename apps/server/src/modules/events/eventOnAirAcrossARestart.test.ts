/**
 * A notice on air when the server restarts (apps/server)
 *
 * What this module is for:
 *   An event's notice leaves the air by the auto-out, after its rule's time; a restart
 *   reschedules no auto-out, so a notice on air at a restart would stay up for good, and
 *   the automatic queue would wait behind it forever (gate 2 of PR #22). So the boot takes
 *   every program instance an event put on air off, and marks its event shown.
 *
 * What these tests prove:
 *   - A penalty on air before a restart is off the air after it, its event shown at the
 *     moment of the boot, and the instances row is saved without it.
 *   - The operator's own graphic on another layer stays on air across the same restart.
 *
 * What these tests deliberately do not cover:
 *   - The auto-out itself; core/store/autoOut.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  createPlainClockItem,
  openEventInboxOnTheStore,
  pollTheSimulator,
  readEvent,
  restartTheServer,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';

const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

describe('a restart with a notice on air', () => {
  it("takes the notice off and marks its event shown, keeping the operator's graphic", () => {
    // Arrange: car 47's penalty on air on the clock layer, the operator's own clock on
    // the tower layer, then a minute passes.
    const inboxBefore = openEventInboxOnTheStore();
    const itemId = createClockItemForEvents(inboxBefore.stateStore, 'Relógio — aviso');
    applyOrThrow(inboxBefore.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
    const plainClockItemId = createPlainClockItem(inboxBefore.stateStore, 'Relógio da prova');
    applyOrThrow(inboxBefore.stateStore, {
      type: 'updateItemFields',
      itemId: plainClockItemId,
      layerId: 'tower',
    });
    applyOrThrow(inboxBefore.stateStore, { type: 'takeItem', itemId: plainClockItemId });
    pollTheSimulator(inboxBefore, buildShapesWithCar31Leading([]));
    pollTheSimulator(inboxBefore, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
    applyOrThrow(inboxBefore.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });
    inboxBefore.clock.letTimePass(60_000);

    // Act: restart.
    const inbox = restartTheServer(inboxBefore);

    // Assert: only the operator's clock is on air; the penalty is shown, at the boot.
    const instancesOnAir = inbox.stateStore.readAllSlices().instances;
    expect(
      instancesOnAir.map((instance) => [instance.layerId, instance.itemId]),
      "only the operator's own graphic may stay on air",
    ).toEqual([['tower', plainClockItemId]]);
    expect(
      readEvent(inbox.stateStore, startPenaltyEventId)?.statusChanges.at(-1),
      'the penalty was shown, its notice taken off at the boot',
    ).toEqual({ status: 'shown', atMs: Date.parse(startOfTheTests) + 60_000 });

    // Act again: one more restart, to read back what the boot saved.
    const inboxAfterASecondRestart = restartTheServer(inbox);

    // Assert: the boot's change was saved, not only held in memory.
    expect(
      inboxAfterASecondRestart.stateStore.readAllSlices().instances.length,
      'the instances row was saved without the notice',
    ).toBe(1);
    expect(
      readEvent(inboxAfterASecondRestart.stateStore, startPenaltyEventId)?.status,
      'the events row was saved with the event shown',
    ).toBe('shown');
  });
});
