/**
 * Events follow the instances that show them (apps/server)
 *
 * What this module is for:
 *   followEventsOfProgramInstances is the one rule that moves an inbox event on and off
 *   the air (BAJAOVRLAY-44): a waiting event is on air while a program instance carries its
 *   id, and shown once no program instance does. reduceCommand runs it after every command
 *   that changed the instances.
 *
 * What these tests prove:
 *   - A waiting event becomes onAir with the instance carrying its id.
 *   - An onAir event whose instance was replaced by another carrying the same id (a
 *     preview of it taken over it) stays onAir, naming the new instance: it has not left
 *     the air (gate 2 of PR #22).
 *   - An onAir event no program instance carries any more is shown.
 *
 * What these tests deliberately do not cover:
 *   - Which commands make or remove those instances; the inbox's store tests.
 */
import type { InboxEvent, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildRaceDaySlicesWithInstances } from '../../../core/store/reducers/raceDaySlices.testSupport.js';
import { followEventsOfProgramInstances } from './eventsOfInstancesBookkeeping.js';

const penaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';
const momentOfTheCommand = '2027-08-14T14:10:00.000Z';

/** Car 47's penalty in the given status (on air with the instance given, if any). */
function buildPenaltyEvent(status: 'pending' | 'onAir', instanceId?: string): InboxEvent {
  const event: InboxEvent = {
    eventId: penaltyEventId,
    kind: 'newIncident',
    sourceId: 'simulador-enduro',
    detectedAtMs: Date.parse('2027-08-14T14:05:00.000Z'),
    payload: { carNumber: 47, teamName: 'Carnaúba Baja', reason: 'Queima de largada' },
    status,
    statusChanges: [{ status, atMs: Date.parse('2027-08-14T14:05:00.000Z') }],
  };
  if (instanceId !== undefined) {
    event.instanceId = instanceId;
  }
  return event;
}

/** A notice on the program output with this id, carrying the penalty's id or none. */
function buildNoticeOnProgram(instanceId: string, eventId: string | undefined): Instance {
  const instance: Instance = {
    id: instanceId,
    layerId: 'notice',
    graphicId: 'notice',
    target: 'program',
    resolvedData: { variant: 'penalty', carNumber: 47 },
    currentStep: 0,
    status: 'on-air',
    takenAt: momentOfTheCommand,
    itemId: 'penalidade',
  };
  if (eventId !== undefined) {
    instance.eventId = eventId;
  }
  return instance;
}

const bookkeepingScenarios = [
  // The usual start: "No ar" put the notice on air.
  {
    name: 'puts a waiting event on air with the instance carrying its id',
    event: buildPenaltyEvent('pending'),
    instances: [buildNoticeOnProgram('instancia-nova', penaltyEventId)],
    expectedStatusAndInstance: ['onAir', 'instancia-nova'],
  },
  // The case gate 2 found: the event's own preview taken over its notice on air.
  {
    name: 'keeps an event on air when its notice is replaced by another of the same event',
    event: buildPenaltyEvent('onAir', 'instancia-antiga'),
    instances: [buildNoticeOnProgram('instancia-nova', penaltyEventId)],
    expectedStatusAndInstance: ['onAir', 'instancia-nova'],
  },
  // The usual end: the auto-out cleared the layer.
  {
    name: 'marks an event shown once nothing on program carries its id',
    event: buildPenaltyEvent('onAir', 'instancia-antiga'),
    instances: [],
    expectedStatusAndInstance: ['shown', undefined],
  },
];

describe('followEventsOfProgramInstances', () => {
  it.each(bookkeepingScenarios)('$name', ({ event, instances, expectedStatusAndInstance }) => {
    // Arrange: this row's event and program instances.
    const slices = { ...buildRaceDaySlicesWithInstances(instances), events: [event] };

    // Act: follow the instances.
    const slicesAfter = followEventsOfProgramInstances(slices, momentOfTheCommand);

    // Assert: the event's status and instance as this row expects.
    const eventAfter = slicesAfter.events[0];
    expect(
      [eventAfter?.status, eventAfter?.instanceId],
      'the event must follow the instance showing it',
    ).toEqual(expectedStatusAndInstance);
  });
});
