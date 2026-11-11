import type { InboxEvent, InboxEventStatus, RestoreEventCommand } from '@bajaovrlay/shared';

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
  readMomentTheWaitCountsFrom,
  replaceInboxEventAtTheEnd,
} from './inboxEventChanges.js';

/** The statuses an event can be brought back from. */
const statusesThatCanBeRestored: InboxEventStatus[] = ['dismissed', 'shown', 'expired'];

/**
 * restoreEvent brings an event back to wait for the operator: a dismissed one ("Desfazer"
 * on the console, "Restaurar" on the "Eventos" page), or, since BAJAOVRLAY-67, a shown or
 * expired one ("Mostrar de novo": the commentators come back to a penalty). It lands at the
 * command's moment:
 * - pending, whatever its rule says: a corrected mistake or a second showing is the
 *   operator's to put on air, never the runner's seconds later, and even a rule now on
 *   "Ignorar" lists it, since the operator asked for this one by name;
 * - approved, for a Super Chat a person had approved and that was shown or expired since:
 *   it needs no second approval. A discarded Super Chat waits for approval again (gate 2 of
 *   PR #54), as does one that expired before anyone approved it.
 * The moment is added to the event's restoresAtMs, and its rule's maximum wait counts from
 * it from then on (readMomentTheWaitCountsFrom). Refused: an unknown event
 * (EVENT_NOT_FOUND), one still waiting or on air (EVENT_NOT_DISMISSED, saying its status),
 * and a dismissed one past its rule's maximum wait (EVENT_TOO_OLD), which would only
 * expire at "No ar". A shown or expired one is never too old: bringing it back restarts
 * its wait. A kind with no maximum wait can be restored hours later, on purpose.
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
  if (!statusesThatCanBeRestored.includes(event.status)) {
    return {
      status: 'refused',
      error: {
        code: 'EVENT_NOT_DISMISSED',
        message: ptBR.eventErrors.eventCannotComeBack(event.status),
      },
    };
  }
  const nowMs = readMomentMs(context.now);
  if (event.status === 'dismissed') {
    const maxAgeMs = findRuleOfKind(slices.eventRules, event.kind)?.maxAgeMs ?? null;
    const ageMs = nowMs - readMomentTheWaitCountsFrom(event);
    if (maxAgeMs !== null && ageMs > maxAgeMs) {
      return {
        status: 'refused',
        error: { code: 'EVENT_TOO_OLD', message: ptBR.eventErrors.eventTooOldToRestore },
      };
    }
  }
  const statusAfter = chooseStatusOfRestoredEvent(event);
  const restoredEvent: InboxEvent = {
    ...changeStatusOfEvent(event, statusAfter, nowMs),
    restoresAtMs: [...(event.restoresAtMs ?? []), nowMs],
  };
  return {
    status: 'applied',
    // Moved to the end of the slice: it waits again, so it must not be the next event a
    // full slice drops (gate 2 of PR #58). The waiting list then shows it first.
    slices: { ...slices, events: replaceInboxEventAtTheEnd(slices.events, restoredEvent) },
  };
}

/**
 * Where a restored event lands: approved for a Super Chat a person approved after its
 * latest discard and that is not discarded now (shown, or expired after approval), pending
 * for everything else. An approval from before a discard does not count: the discard took
 * it back (gate 2 of PR #58).
 */
function chooseStatusOfRestoredEvent(event: InboxEvent): InboxEventStatus {
  if (event.kind !== 'superChat' || event.status === 'dismissed') {
    return 'pending';
  }
  const changesInOrder = event.statusChanges;
  const placeOfLatestDiscard = changesInOrder.findLastIndex(
    (change) => change.status === 'dismissed',
  );
  const changesSinceTheLatestDiscard = changesInOrder.slice(placeOfLatestDiscard + 1);
  const wasApprovedSinceTheLatestDiscard = changesSinceTheLatestDiscard.some(
    (change) => change.status === 'approved',
  );
  return wasApprovedSinceTheLatestDiscard ? 'approved' : 'pending';
}
