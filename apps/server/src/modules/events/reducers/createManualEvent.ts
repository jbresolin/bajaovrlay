import type { CreateManualEventCommand, InboxEvent,InboxEventPayload } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
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
 * notice about one car, or a notice about no car (a general notice, BAJAOVRLAY-67), with
 * no source, dated now, pending (or queued when the manual rule says auto). Its id is
 * `manual:<id the store made>`. A team or school left blank is read from the first source
 * (in the sources' order) whose positions list the car, and, when no source does, from
 * Cadastros (the teams of the entity library, BAJAOVRLAY-67): the source wins, since it is
 * what the timing screen shows on the day. When neither knows the car, they stay out and
 * the notice shows the car alone. What the operator typed always wins over both.
 * Refused: a penalty with no car (PENALTY_WITHOUT_CAR): a penalty is always given to one.
 */
export function reduceCreateManualEvent(
  slices: SlicesChangedByCommands,
  command: CreateManualEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const carNumber = command.carNumber;
  if (command.noticeKind === 'penalty' && carNumber === undefined) {
    return {
      status: 'refused',
      error: { code: 'PENALTY_WITHOUT_CAR', message: ptBR.eventErrors.penaltyWithoutCar },
    };
  }
  const nowMs = readMomentMs(context.now);
  const payload: InboxEventPayload = { noticeKind: command.noticeKind, reason: command.reason };
  if (carNumber !== undefined) {
    payload.carNumber = carNumber;
    const teamKnown = findTeamAndSchoolOfCar(slices, carNumber);
    const teamName = command.teamName ?? teamKnown?.teamName;
    if (teamName !== undefined) {
      payload.teamName = teamName;
    }
    const schoolName = command.schoolName ?? teamKnown?.schoolName;
    if (schoolName !== undefined) {
      payload.schoolName = schoolName;
    }
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

/** A car's team and school, as a source or Cadastros knows them. */
type TeamAndSchool = { teamName: string; schoolName: string };

/**
 * The team and school of this car: from the first source's positions that list it, or
 * else from its team in Cadastros, or undefined when neither knows it.
 */
function findTeamAndSchoolOfCar(
  slices: SlicesChangedByCommands,
  carNumber: number,
): TeamAndSchool | undefined {
  for (const dataSource of slices.dataSources) {
    const snapshot = slices.dataSnapshots.find((stored) => stored.sourceId === dataSource.id);
    const car = snapshot?.shapes.positions?.entries.find((entry) => entry.carNumber === carNumber);
    if (car !== undefined) {
      return { teamName: car.teamName, schoolName: car.schoolName };
    }
  }
  const teamInCadastros = slices.teams.find((team) => team.carNumber === carNumber);
  if (teamInCadastros !== undefined) {
    return { teamName: teamInCadastros.teamName, schoolName: teamInCadastros.schoolName };
  }
  return undefined;
}
