// The refusals of the trigger commands (BAJAOVRLAY-48), each with its stable code and
// pt-BR message.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/** The refusal for a command naming a trigger that does not exist. */
export function refuseUnknownTrigger(triggerId: string): CommandError {
  return { code: 'TRIGGER_NOT_FOUND', message: ptBR.triggers.triggerNotFound(triggerId) };
}

/** The refusal for a call to the address of a trigger that is not an HTTP trigger. */
export function refuseTriggerThatIsNotHttp(triggerName: string): CommandError {
  return { code: 'TRIGGER_NOT_FOUND', message: ptBR.triggers.triggerIsNotHttp(triggerName) };
}

/** The refusal for an answer to a firing no longer in the list. */
export function refuseUnknownFiring(): CommandError {
  return { code: 'TRIGGER_FIRING_NOT_FOUND', message: ptBR.triggers.firingNotFound };
}

/** The refusal for "Rodar" or "Descartar" of a firing that no longer waits. */
export function refuseFiringNotWaiting(triggerName: string): CommandError {
  return {
    code: 'TRIGGER_FIRING_NOT_WAITING',
    message: ptBR.triggers.firingNotWaiting(triggerName),
  };
}

/** The refusal for "Desfazer" of a firing that is not dismissed. */
export function refuseFiringNotDismissed(triggerName: string): CommandError {
  return {
    code: 'TRIGGER_FIRING_NOT_DISMISSED',
    message: ptBR.triggers.firingNotDismissed(triggerName),
  };
}
