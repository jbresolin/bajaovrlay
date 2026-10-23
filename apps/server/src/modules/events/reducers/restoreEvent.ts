import type { RestoreEventCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  changeStatusOfEvent,
  findInboxEvent,
  findRuleOfKind,
  readMomentMs,
  replaceInboxEvent,
} from './inboxEventChanges.js';

/**
 * restoreEvent ("Desfazer" on the console, "Restaurar" on the "Eventos" page): undoes
 * "Descartar". A dismissed event goes back to pending at the command's moment, even when
 * its rule is automatic: a corrected mistake is the operator's to show, so it never goes
 * on air by itself seconds after being brought back; and even when its rule is now
 * "Ignorar", since the operator asked for this one by name. Refused for an unknown event
 * (EVENT_NOT_FOUND), one that was not dismissed (EVENT_NOT_DISMISSED: a shown event
 * brought back would show twice), and one past its rule's maximum wait (EVENT_TOO_OLD),
 * which would only expire at "No ar". A kind with no maximum wait (incidents and typed
 * events by default) can be restored hours later, on purpose: a penalty stays news.
 */
export function reduceRestoreEvent(
  slices: SlicesChangedByCommands,
  command: RestoreEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const event = findInboxEvent(slices.events, command.eventId);
  if (event === undefined) {
    return {
      status: 'refused',
      error: { code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound },
    };
  }
  if (event.status !== 'dismissed') {
    return {
      status: 'refused',
      error: {
        code: 'EVENT_NOT_DISMISSED',
        message: ptBR.eventErrors.eventNotDismissed(event.status),
      },
    };
  }
  const nowMs = readMomentMs(context.now);
  const maxAgeMs = findRuleOfKind(slices.eventRules, event.kind)?.maxAgeMs ?? null;
  const ageMs = nowMs - event.detectedAtMs;
  if (maxAgeMs !== null && ageMs > maxAgeMs) {
    return {
      status: 'refused',
      error: { code: 'EVENT_TOO_OLD', message: ptBR.eventErrors.eventTooOldToRestore },
    };
  }
  const restoredEvent = changeStatusOfEvent(event, 'pending', nowMs);
  return {
    status: 'applied',
    slices: { ...slices, events: replaceInboxEvent(slices.events, restoredEvent) },
  };
}
