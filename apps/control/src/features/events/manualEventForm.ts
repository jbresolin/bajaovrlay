/**
 * The "+ Evento" form as text, and the createManualEvent it becomes. Pure, so each rule
 * is tested without a page; the server checks the command again (its schema).
 */
import type { CreateManualEventCommand } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { generalNoticeTeamChoice } from './manualEventTeamPick';

const problems = ptBR.events.manualForm.problems;

/**
 * What the form holds while the operator types: every field as the text in its input, the
 * team list's choice (BAJAOVRLAY-67: '' for none, a car number for a team of Cadastros,
 * or generalNoticeTeamChoice for "Sem equipe (aviso geral)"), and which of the team and
 * school a typed car number filled, so the next number may replace them
 * (manualEventTeamPick.ts).
 */
export type ManualEventFormValues = {
  noticeKind: 'penalty' | 'notice';
  teamChoice: string;
  carNumberText: string;
  teamName: string;
  schoolName: string;
  reason: string;
  penaltyText: string;
  fieldsFilledFromTheCarNumber: Array<'teamName' | 'schoolName'>;
};

/** A new form: a penalty, no team chosen, every field empty. */
export const emptyManualEventFormValues: ManualEventFormValues = {
  noticeKind: 'penalty',
  teamChoice: '',
  carNumberText: '',
  teamName: '',
  schoolName: '',
  reason: '',
  penaltyText: '',
  fieldsFilledFromTheCarNumber: [],
};

/** What reading the form gives: the command to send, or the first problem in pt-BR. */
export type ManualEventFormReading =
  { status: 'ready'; command: CreateManualEventCommand } | { status: 'problem'; message: string };

/**
 * Reads the form into createManualEvent: the car a whole number from 1, the reason
 * required; team, school and (for a penalty only) the penalty left out when blank, so the
 * server reads team and school from the sources, then Cadastros. A general notice
 * (BAJAOVRLAY-67) is sent with no car, team or school, and is refused as a penalty: a
 * penalty is always given to a car. The first problem is said, one at a time.
 */
export function readManualEventFormIntoCommand(
  values: ManualEventFormValues,
): ManualEventFormReading {
  if (values.teamChoice === generalNoticeTeamChoice) {
    return readGeneralNoticeIntoCommand(values);
  }
  const carNumberText = values.carNumberText.trim();
  const isWholeNumber = /^\d+$/.test(carNumberText);
  const carNumber = Number(carNumberText);
  if (!isWholeNumber || carNumber < 1) {
    return { status: 'problem', message: problems.carNumber };
  }
  const reason = values.reason.trim();
  if (reason === '') {
    return { status: 'problem', message: problems.reason };
  }

  const command: CreateManualEventCommand = {
    type: 'createManualEvent',
    noticeKind: values.noticeKind,
    carNumber,
    reason,
  };
  const teamName = values.teamName.trim();
  if (teamName !== '') {
    command.teamName = teamName;
  }
  const schoolName = values.schoolName.trim();
  if (schoolName !== '') {
    command.schoolName = schoolName;
  }
  const penaltyText = values.penaltyText.trim();
  if (values.noticeKind === 'penalty' && penaltyText !== '') {
    command.penaltyText = penaltyText;
  }
  return { status: 'ready', command };
}

/** Reads a general notice, about no car: the reason only; never a penalty. */
function readGeneralNoticeIntoCommand(values: ManualEventFormValues): ManualEventFormReading {
  if (values.noticeKind === 'penalty') {
    return { status: 'problem', message: problems.penaltyWithoutCar };
  }
  const reason = values.reason.trim();
  if (reason === '') {
    return { status: 'problem', message: problems.reason };
  }
  return { status: 'ready', command: { type: 'createManualEvent', noticeKind: 'notice', reason } };
}
