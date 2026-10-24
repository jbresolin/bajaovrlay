/**
 * Detecting events in the sources' data, through a real store (apps/server)
 *
 * What this module is for:
 *   The event detection (eventDetection.ts) watches every accepted poll. It compares a
 *   source's new snapshot with the one before it, runs the detectors, and records what
 *   they found through the one command path, as the actor `sistema:eventos`
 *   (recordDetectedEvents, one command per event). After a boot it starts from each
 *   source's last saved snapshot, so what happened while the server was down arrives
 *   (João's call at gate 2 of PR #22); the inbox keeps the ids it has seen (the `events`
 *   slice is saved), so an incident seen before a restart is never listed twice. The first
 *   snapshot of a source turned on, of a source whose config changed (another race,
 *   another mapping), or of a source never polled before, is a baseline: it says what had
 *   already happened, so nothing fires.
 *
 * What these tests prove:
 *   - A source's first poll ever fires nothing, even with a penalty in it.
 *   - A penalty in the next poll is listed as pending (its rule asks the operator), with
 *     its arrival moment, and writes one event-log row signed sistema:eventos.
 *   - A fastest lap is listed as queued (its rule puts it on air by itself).
 *   - After a restart nothing is replayed: an incident seen before the restart is not
 *     listed a second time when it comes back.
 *   - A penalty given while the server was down is listed at the first poll after the
 *     boot, once.
 *   - The first poll after the source is turned off and on again is a baseline, and so is
 *     the first after its config changed.
 *   - A fastest lap whose rule says auto but names no item is listed as pending, for the
 *     operator, never queued for a runner that could not show it.
 *   - An event whose rule says "ignore" is not listed and writes no row.
 *   - Polls with nothing new write no row (the poll itself writes none, as before).
 *
 * What these tests deliberately do not cover:
 *   - What each detector finds; detectEventsBetweenSnapshots.test.ts covers that.
 *   - Showing, dismissing and expiring events; inboxCommandsOnTheStore.test.ts.
 *   - The automatic runner that shows queued events; eventRunner.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildBlockingWarningOfCar38,
  buildPositionsInOrder,
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  enduroSimulatorId,
  openEventInboxOnTheStore,
  pollTheSimulator,
  readCommandsOfNewestLogRows,
  readEvent,
  restartTheServer,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';

/** The id the inbox gives car 47's start penalty from the simulator. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/** The id the inbox gives car 38's blocking warning from the simulator. */
const blockingWarningEventId = 'simulador-enduro:incident:ocorrencia-0012';

describe('the event detection on the store', () => {
  it("records nothing from a source's first poll, which is the baseline", () => {
    // Arrange: a fresh server with the simulator on.
    const inbox = openEventInboxOnTheStore();

    // Act: the first poll arrives, already listing car 47's penalty.
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: the inbox is empty; that penalty was given before we were watching.
    expect(inbox.stateStore.readAllSlices().events, 'a baseline must list nothing').toEqual([]);
  });

  it('records a penalty from the next poll as pending, with one event-log row', () => {
    // Arrange: a first poll with no incident, the baseline.
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: a minute later, the next poll lists car 47's penalty.
    inbox.clock.letTimePass(60_000);
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: listed once, waiting for the operator since the poll's moment, and logged
    // as recordDetectedEvents by the detection.
    const arrivedAtMs = Date.parse(startOfTheTests) + 60_000;
    const events = inbox.stateStore.readAllSlices().events;
    expect(events, 'one event must be listed').toHaveLength(1);
    expect(events[0], 'the penalty must wait for the operator').toEqual({
      eventId: startPenaltyEventId,
      kind: 'newIncident',
      sourceId: enduroSimulatorId,
      detectedAtMs: arrivedAtMs,
      payload: {
        carNumber: 47,
        teamName: 'Carnaúba Baja',
        schoolName: 'UFERSA',
        noticeKind: 'penalty',
        reason: 'Queima de largada',
        penaltyText: '+30 segundos',
        lapNumber: 1,
      },
      status: 'pending',
      statusChanges: [{ status: 'pending', atMs: arrivedAtMs }],
    });
    const lastRow = inbox.stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.command, 'the detection must write one row').toBe('recordDetectedEvents');
    expect(lastRow?.actor, 'the row must be signed by the detection').toBe('sistema:eventos');
  });

  it('records a fastest lap as queued, because its rule puts it on air by itself', () => {
    // Arrange: the baseline, car 31 holding the best lap with 4:38,291.
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: car 47 sets 4:37,900 on its lap 34, still 3rd.
    pollTheSimulator(inbox, {
      positions: buildPositionsInOrder([
        { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
      ]),
    });

    // Assert: one fastest lap, queued for the runner.
    const events = inbox.stateStore.readAllSlices().events;
    expect(
      events.map((event) => [event.kind, event.payload.carNumber, event.status]),
      'the fastest lap must be queued',
    ).toEqual([['fastestLap', 47, 'queued']]);
  });

  it('replays nothing after a restart, and never lists an incident it has already seen', () => {
    // Arrange: the penalty recorded before a restart.
    const inboxBeforeRestart = openEventInboxOnTheStore();
    pollTheSimulator(inboxBeforeRestart, buildShapesWithCar31Leading([]));
    pollTheSimulator(inboxBeforeRestart, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Act: restart; the first poll after it lists nothing (a source restarting its list),
    // and the next one lists the penalty again with a new warning.
    const inbox = restartTheServer(inboxBeforeRestart);
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    pollTheSimulator(
      inbox,
      buildShapesWithCar31Leading([buildStartPenaltyOfCar47(), buildBlockingWarningOfCar38()]),
    );

    // Assert: the penalty is listed once, as before the restart, and only the warning
    // was added.
    const eventIds = inbox.stateStore.readAllSlices().events.map((event) => event.eventId);
    expect(eventIds, 'the penalty once, then the new warning').toEqual([
      startPenaltyEventId,
      blockingWarningEventId,
    ]);
  });

  it('lists a penalty given while the server was down at the first poll after the boot, once', () => {
    // Arrange: the baseline before the restart, with no incident.
    const inboxBeforeRestart = openEventInboxOnTheStore();
    pollTheSimulator(inboxBeforeRestart, buildShapesWithCar31Leading([]));

    // Act: restart; the first poll lists the penalty given while the server was down, and
    // the next one lists it again.
    const inbox = restartTheServer(inboxBeforeRestart);
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: listed once, waiting for the operator: the detection started from the last
    // snapshot saved before the restart.
    expect(
      inbox.stateStore.readAllSlices().events.map((event) => [event.eventId, event.status]),
      'what happened while the server was down must arrive, once',
    ).toEqual([[startPenaltyEventId, 'pending']]);
  });

  it('takes the first poll after the source config changed as the baseline', () => {
    // Arrange: the baseline, then the simulator set to speed 30 (another race moment, and
    // for a flex source another mapping that could list the whole day as new).
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    applyOrThrow(inbox.stateStore, {
      type: 'updateDataSource',
      sourceId: enduroSimulatorId,
      config: { speed: 30 },
    });

    // Act: its first poll since lists a penalty.
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: nothing listed.
    expect(inbox.stateStore.readAllSlices().events, 'a changed config starts a baseline').toEqual(
      [],
    );
  });

  it('lists a fastest lap as pending when its auto rule names no item', () => {
    // Arrange: the fastest-lap rule left on auto with no item, and the baseline.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', itemId: null });
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: car 47 sets 4:37,900.
    pollTheSimulator(inbox, {
      positions: buildPositionsInOrder([
        { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
      ]),
    });

    // Assert: pending, for the operator: no runner could show it without an item.
    expect(
      inbox.stateStore.readAllSlices().events.map((event) => event.status),
      'an auto rule with no item asks instead',
    ).toEqual(['pending']);
  });

  it('takes the first poll after the source is turned on again as the baseline', () => {
    // Arrange: the baseline, then the simulator turned off and on again.
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    applyOrThrow(inbox.stateStore, {
      type: 'setDataSourceEnabled',
      sourceId: enduroSimulatorId,
      isEnabled: false,
    });
    applyOrThrow(inbox.stateStore, {
      type: 'setDataSourceEnabled',
      sourceId: enduroSimulatorId,
      isEnabled: true,
    });

    // Act: its first poll lists a penalty it gave while off.
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: nothing listed.
    expect(inbox.stateStore.readAllSlices().events, 'a source turned on starts a baseline').toEqual(
      [],
    );
  });

  it('lists nothing and writes no row for an event whose rule says ignore', () => {
    // Arrange: the rule of incidents set to ignore, and the baseline.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      mode: 'ignore',
    });
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: the penalty arrives.
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Assert: no event, and the newest row is still the operator's rule change.
    expect(readEvent(inbox.stateStore, startPenaltyEventId), 'an ignored kind is not listed').toBe(
      undefined,
    );
    expect(
      readCommandsOfNewestLogRows(inbox.stateStore, 1),
      'nothing was written after the rule change',
    ).toEqual(['updateEventRule']);
  });

  it('writes no row for a poll with nothing new', () => {
    // Arrange: the baseline, and the row count after it.
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    const rowsBefore = inbox.stateStore.readAllSlices().eventLog.length;

    // Act: a poll a lap later, the same leader, no new best, no incident.
    pollTheSimulator(inbox, {
      positions: buildPositionsInOrder([
        { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 38, laps: 35, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 47, laps: 34, bestLapMs: 280_496, bestLapNumber: 30 },
      ]),
      incidents: buildShapesWithCar31Leading([]).incidents,
    });

    // Assert: no row was added, by the poll or by the detection.
    expect(
      inbox.stateStore.readAllSlices().eventLog,
      'a routine poll with nothing new must stay out of the log',
    ).toHaveLength(rowsBefore);
  });
});
