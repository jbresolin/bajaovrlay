import type { ApproveEventCommand } from '@bajaovrlay/shared';

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
 * approveEvent ("Aprovar", BAJAOVRLAY-35): a person read a viewer's Super Chat and lets it
 * go on air; the pending Super Chat becomes approved at the command's moment and waits for
 * the Produtor's "No ar". Nothing goes on air here: approving and airing are two people's
 * steps (Dados reads the chat, the Produtor runs the show). Refused for an unknown event
 * (EVENT_NOT_FOUND), for any kind but a Super Chat, and for a Super Chat that is not
 * pending (EVENT_NOT_APPROVABLE: approved twice, already on air, discarded…).
 */
export function reduceApproveEvent(
  slices: SlicesChangedByCommands,
  command: ApproveEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const event = findInboxEvent(slices.events, command.eventId);
  if (event === undefined) {
    return {
      status: 'refused',
      error: { code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound },
    };
  }
  if (event.kind !== 'superChat') {
    return {
      status: 'refused',
      error: { code: 'EVENT_NOT_APPROVABLE', message: ptBR.eventErrors.onlyASuperChatIsApproved },
    };
  }
  if (event.status !== 'pending') {
    return {
      status: 'refused',
      error: {
        code: 'EVENT_NOT_APPROVABLE',
        message: ptBR.eventErrors.superChatNotPending(event.status),
      },
    };
  }
  const approvedEvent = changeStatusOfEvent(event, 'approved', readMomentMs(context.now));
  return {
    status: 'applied',
    slices: { ...slices, events: replaceInboxEvent(slices.events, approvedEvent) },
  };
}
