/**
 * A restored event keeps its place in the inbox while it waits (apps/server)
 *
 * What this module is for:
 *   The inbox slice keeps only the newest 200 events: each new detection pushes the
 *   oldest out of it (the event log keeps them all). An event brought back with
 *   "Restaurar" or "Mostrar de novo" waits for the operator again, so it must not be the
 *   next to fall out just because it was detected long ago (gate 2 of PR #58). restoreEvent
 *   therefore moves it to the end of the slice, where the newest events are.
 *
 * What these tests prove, through a real store on a temporary database:
 *   - On a full slice, a shown penalty brought back is moved to its end, and a new
 *     detection afterwards pushes out the oldest other event, not the restored one.
 *
 * What these tests deliberately do not cover:
 *   - Where a restored event lands and who may restore it; showEventAgainOnTheStore.test.ts
 *     and restoreEventOnTheStore.test.ts.
 */
import { type DetectedEvent, inboxEventsSliceSize } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { eventInboxActor } from '../../core/store/commandActors.js';
import { applyOrThrow, type EventInboxOnTheStore } from './eventInboxOnTheStore.testSupport.js';
import {
  eventIdOfKind,
  openInboxWithAnEventOfEachKind,
  showAndClear,
} from './showEventAgain.testSupport.js';

/** The race direction's warnings, numbered from `firstNumber`, detected at the inbox's now. */
function buildWarningsOfTheRaceDirection(
  inbox: EventInboxOnTheStore,
  firstNumber: number,
  count: number,
): DetectedEvent[] {
  const detectedAtMs = inbox.clock.readCurrentTime().getTime();
  const warnings: DetectedEvent[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const warningNumber = firstNumber + offset;
    warnings.push({
      eventId: `simulador-enduro:incident:advertencia-${String(warningNumber).padStart(4, '0')}`,
      kind: 'newIncident',
      sourceId: 'simulador-enduro',
      detectedAtMs,
      payload: { carNumber: 12, noticeKind: 'warning', reason: 'Bloqueio de ultrapassagem' },
    });
  }
  return warnings;
}

/** Records events as the inbox does after a poll. */
function recordDetectedEvents(inbox: EventInboxOnTheStore, events: DetectedEvent[]): void {
  applyOrThrow(inbox.stateStore, { type: 'recordDetectedEvents', events }, eventInboxActor);
}

/** The ids of the slice's events, oldest first. */
function readEventIdsOfTheSlice(inbox: EventInboxOnTheStore): string[] {
  return inbox.stateStore.readAllSlices().events.map((event) => event.eventId);
}

describe('a restored event on a full inbox slice', () => {
  it('moves the restored event to the end, so the next detection pushes out another', () => {
    // Arrange: car 47's penalty shown and cleared, then enough warnings to fill the slice,
    // so the penalty is its oldest event.
    const inbox = openInboxWithAnEventOfEachKind();
    showAndClear(inbox, 'newIncident');
    const eventsAlreadyThere = readEventIdsOfTheSlice(inbox).length;
    recordDetectedEvents(
      inbox,
      buildWarningsOfTheRaceDirection(inbox, 1, inboxEventsSliceSize - eventsAlreadyThere),
    );
    const idsBefore = readEventIdsOfTheSlice(inbox);
    const secondOldestId = idsBefore[1];

    // Act: "Mostrar de novo" on the penalty, then one more warning is detected.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.newIncident });
    const idsAfterTheRestore = readEventIdsOfTheSlice(inbox);
    recordDetectedEvents(inbox, buildWarningsOfTheRaceDirection(inbox, 500, 1));
    const idsAfterTheNewWarning = readEventIdsOfTheSlice(inbox);

    // Assert: the slice was full with the penalty first; the restore moved it to the end;
    // the new warning pushed out the next oldest event and the penalty is still listed.
    expect(idsBefore, 'the slice must be full, the penalty its oldest event').toHaveLength(
      inboxEventsSliceSize,
    );
    expect(idsBefore[0], 'the penalty must be the oldest event before the restore').toBe(
      eventIdOfKind.newIncident,
    );
    expect(idsAfterTheRestore.at(-1), 'the restored penalty must be moved to the end').toBe(
      eventIdOfKind.newIncident,
    );
    expect(
      idsAfterTheNewWarning,
      'the restored penalty must still be listed after the next detection',
    ).toContain(eventIdOfKind.newIncident);
    expect(
      idsAfterTheNewWarning,
      'the oldest event other than the penalty is the one pushed out',
    ).not.toContain(secondOldestId);
    expect(idsAfterTheNewWarning, 'the slice keeps its size').toHaveLength(inboxEventsSliceSize);
  });
});
