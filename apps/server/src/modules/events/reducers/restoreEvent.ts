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
  readMomentMs,
  replaceInboxEvent,
} from './inboxEventChanges.js';

/**
 * restoreEvent ("Desfazer" on the console, "Restaurar" on the "Eventos" page): undoes
 * "Descartar". A dismissed event goes back to pending at the command's moment, even when
 * its rule is automatic: a corrected mistake is the operator's to show, so it never goes
 * on air by itself seconds after being brought back. Its max age still holds, checked by
 * "No ar" as for any event. Refused for an unknown event (EVENT_NOT_FOUND) and one that
 * was not dismissed (EVENT_NOT_DISMISSED): a shown event brought back would show twice.
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
  const restoredEvent = changeStatusOfEvent(event, 'pending', readMomentMs(context.now));
  return {
    status: 'applied',
    slices: { ...slices, events: replaceInboxEvent(slices.events, restoredEvent) },
  };
}
