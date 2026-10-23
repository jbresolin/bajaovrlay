import type { DismissEventCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  changeStatusOfEvent,
  findInboxEvent,
  isEventWaiting,
  readMomentMs,
  replaceInboxEvent,
} from './inboxEventChanges.js';

/**
 * dismissEvent ("Descartar"): the operator says no to a waiting event (pending or
 * queued); it is dismissed at the command's moment and never shown. Refused for an
 * unknown event (EVENT_NOT_FOUND) and one no longer waiting (EVENT_NOT_WAITING): an event
 * on air is taken off with the layer's "Limpar".
 */
export function reduceDismissEvent(
  slices: SlicesChangedByCommands,
  command: DismissEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const event = findInboxEvent(slices.events, command.eventId);
  if (event === undefined) {
    return {
      status: 'refused',
      error: { code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound },
    };
  }
  if (!isEventWaiting(event)) {
    return {
      status: 'refused',
      error: { code: 'EVENT_NOT_WAITING', message: ptBR.eventErrors.eventNotWaiting(event.status) },
    };
  }
  const dismissedEvent = changeStatusOfEvent(event, 'dismissed', readMomentMs(context.now));
  return {
    status: 'applied',
    slices: { ...slices, events: replaceInboxEvent(slices.events, dismissedEvent) },
  };
}
