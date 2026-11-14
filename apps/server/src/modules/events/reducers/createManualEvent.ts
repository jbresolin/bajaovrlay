import type { CreateManualEventCommand, InboxEvent, InboxEventPayload } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  appendInboxEvents,
  findRuleOfKind,
  listNewEvent,
  readMomentMs,
} from './inboxEventChanges.js';

/**
 * createManualEvent ("+ Evento"): lists an event the operator typed, a penalty or a
 * notice about one car, or a notice about no car (a general notice, BAJAOVRLAY-67), with
 * no source, dated now, pending (or queued when the manual rule says auto, unless
 * "Pausar gatilhos" holds it pending, BAJAOVRLAY-73). Its id is
 * `manual:<id the store made>`. The page fills team and school from Cadastros and sends
 * them as typed, so what goes on air is what the operator saw in the form. A team or school
 * the command leaves out (the command API, a car Cadastros does not know) is read from the
 * first source (in the sources' order) whose positions list the car, and, when no source
 * does, from Cadastros (BAJAOVRLAY-67). When neither knows the car, they stay out and the
 * notice shows the car alone. What the command carries always wins over both.
 * Refused: a penalty with no car (PENALTY_WITHOUT_CAR): a penalty is always given to one;
 * and a notice with no car but a team or school (GENERAL_NOTICE_WITH_TEAM).
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
  const isATeamOrSchoolSent = command.teamName !== undefined || command.schoolName !== undefined;
  if (carNumber === undefined && isATeamOrSchoolSent) {
    // The page hides team and school for a general notice; another client sending them
    // is told, rather than having them dropped without a word (gate 2 of PR #58).
    return {
      status: 'refused',
      error: { code: 'GENERAL_NOTICE_WITH_TEAM', message: ptBR.eventErrors.generalNoticeWithTeam },
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

  const manualEvent: InboxEvent = listNewEvent(
    {
      eventId: `manual:${context.newEventId}`,
      kind: 'manual',
      sourceId: null,
      detectedAtMs: nowMs,
      payload,
    },
    findRuleOfKind(slices.eventRules, 'manual'),
    slices.triggerActivity.isPaused,
  );
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
