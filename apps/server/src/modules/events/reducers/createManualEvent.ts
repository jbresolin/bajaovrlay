import type {
  CreateManualEventCommand,
  InboxEvent,
  InboxEventPayload,
  PositionEntry,
} from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  appendInboxEvents,
  findRuleOfKind,
  findStatusOfNewEvent,
  readMomentMs,
} from './inboxEventChanges.js';

/**
 * createManualEvent ("+ Evento"): lists an event the operator typed, a penalty or a
 * notice about one car, with no source, dated now, pending (or queued when the manual
 * rule says auto). Its id is `manual:<id the store made>`. A team or school left blank
 * is read from the first source (in the sources' order) whose positions list the car;
 * when none does, it stays out and the notice shows the car alone. What the operator
 * typed always wins. Deliberate: the entity library (BAJAOVRLAY-19) will be the better
 * place to read them from once it is merged; it is not here yet.
 */
export function reduceCreateManualEvent(
  slices: SlicesChangedByCommands,
  command: CreateManualEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const nowMs = readMomentMs(context.now);
  const carListed = findCarInTheSourcesPositions(slices, command.carNumber);
  const payload: InboxEventPayload = {
    carNumber: command.carNumber,
    noticeKind: command.noticeKind,
    reason: command.reason,
  };
  const teamName = command.teamName ?? carListed?.teamName;
  if (teamName !== undefined) {
    payload.teamName = teamName;
  }
  const schoolName = command.schoolName ?? carListed?.schoolName;
  if (schoolName !== undefined) {
    payload.schoolName = schoolName;
  }
  if (command.penaltyText !== undefined) {
    payload.penaltyText = command.penaltyText;
  }

  const status = findStatusOfNewEvent(findRuleOfKind(slices.eventRules, 'manual'));
  const manualEvent: InboxEvent = {
    eventId: `manual:${context.newEventId}`,
    kind: 'manual',
    sourceId: null,
    detectedAtMs: nowMs,
    payload,
    status,
    statusChanges: [{ status, atMs: nowMs }],
  };
  return {
    status: 'applied',
    slices: { ...slices, events: appendInboxEvents(slices.events, [manualEvent]) },
  };
}

/** The car of this number in the first source's positions that list it, or undefined. */
function findCarInTheSourcesPositions(
  slices: SlicesChangedByCommands,
  carNumber: number,
): PositionEntry | undefined {
  for (const dataSource of slices.dataSources) {
    const snapshot = slices.dataSnapshots.find((stored) => stored.sourceId === dataSource.id);
    const car = snapshot?.shapes.positions?.entries.find((entry) => entry.carNumber === carNumber);
    if (car !== undefined) {
      return car;
    }
  }
  return undefined;
}
