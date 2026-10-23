/**
 * The "+ Evento" form as text, and the createManualEvent it becomes. Pure, so each rule
 * is tested without a page; the server checks the command again (its schema).
 */
import type { CreateManualEventCommand } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const problems = ptBR.events.manualForm.problems;

/** What the form holds while the operator types: every field as the text in its input. */
export type ManualEventFormValues = {
  noticeKind: 'penalty' | 'notice';
  carNumberText: string;
  teamName: string;
  schoolName: string;
  reason: string;
  penaltyText: string;
};

/** A new form: a penalty, every field empty. */
export const emptyManualEventFormValues: ManualEventFormValues = {
  noticeKind: 'penalty',
  carNumberText: '',
  teamName: '',
  schoolName: '',
  reason: '',
  penaltyText: '',
};

/** What reading the form gives: the command to send, or the first problem in pt-BR. */
export type ManualEventFormReading =
  { status: 'ready'; command: CreateManualEventCommand } | { status: 'problem'; message: string };

/**
 * Reads the form into createManualEvent: the car a whole number from 1, the reason
 * required; team, school and (for a penalty only) the penalty left out when blank, so the
 * server reads team and school from the sources. The first problem is said, one at a time.
 */
export function readManualEventFormIntoCommand(
  values: ManualEventFormValues,
): ManualEventFormReading {
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
