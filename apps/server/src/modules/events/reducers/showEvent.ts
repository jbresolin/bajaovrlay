import type { CommandError, InboxEvent, ShowEventCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import { putItemOnOutput } from '../../../core/store/reducers/putItemOnOutput.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  changeStatusOfEvent,
  findInboxEvent,
  findRuleOfKind,
  isEventWaiting,
  isSuperChatAwaitingApproval,
  readMomentMs,
  replaceInboxEvent,
} from './inboxEventChanges.js';

/**
 * showEvent ("No ar", or the runner): takes the item the event's rule names onto the
 * program output, filled from the event, with the event's id and the rule's duration
 * on the new instance (the auto-out takes it off after that time). The event becomes
 * onAir in reduceCommand's bookkeeping (eventsOfInstancesBookkeeping.ts), the one place
 * that follows instances carrying an event, so a previewed event taken with "Tomar"
 * counts too.
 * Never shown late: an event older than its rule's maxAgeMs (from its detection) is
 * expired instead, and nothing goes on air; the command is then applied, not refused, so
 * the runner expires a queued event with the one command it may send besides recording.
 * Refused: an unknown event (EVENT_NOT_FOUND), one no longer waiting (EVENT_NOT_WAITING), a
 * Super Chat no person approved (EVENT_NOT_APPROVED, checked after its age, so the runner
 * can expire one no one approved in time; an unapproved one never airs, late or not),
 * a rule with no item (EVENT_RULE_WITHOUT_ITEM), and whatever the take refuses.
 */
export function reduceShowEvent(
  slices: SlicesChangedByCommands,
  command: ShowEventCommand,
  context: ReducerContext,
): ReducerOutcome {
  const event = findInboxEvent(slices.events, command.eventId);
  if (event === undefined) {
    return refuse({ code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound });
  }
  if (!isEventWaiting(event)) {
    return refuse({
      code: 'EVENT_NOT_WAITING',
      message: ptBR.eventErrors.eventNotWaiting(event.status),
    });
  }

  const rule = findRuleOfKind(slices.eventRules, event.kind);
  const nowMs = readMomentMs(context.now);
  if (rule?.maxAgeMs !== null && rule?.maxAgeMs !== undefined) {
    const ageMs = nowMs - event.detectedAtMs;
    if (ageMs > rule.maxAgeMs) {
      return expireEvent(slices, event, nowMs);
    }
  }
  // After the age, so the runner can still expire a Super Chat no one approved in time;
  // expiring puts nothing on air.
  if (isSuperChatAwaitingApproval(event)) {
    return refuse({ code: 'EVENT_NOT_APPROVED', message: ptBR.eventErrors.superChatNotApproved });
  }
  if (rule?.itemId === null || rule?.itemId === undefined) {
    return refuse({
      code: 'EVENT_RULE_WITHOUT_ITEM',
      message: ptBR.eventErrors.ruleWithoutItem(event.kind),
    });
  }

  const takeOutcome = putItemOnOutput(slices, rule.itemId, 'program', context, {
    eventId: event.eventId,
    payload: event.payload,
    autoOutAfterMs: rule.durationMs,
  });
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }
  return { status: 'applied', slices: takeOutcome.slices };
}

/** The event marked expired at `nowMs`; nothing else changes. */
function expireEvent(
  slices: SlicesChangedByCommands,
  event: InboxEvent,
  nowMs: number,
): ReducerOutcome {
  const expiredEvent = changeStatusOfEvent(event, 'expired', nowMs);
  return {
    status: 'applied',
    slices: { ...slices, events: replaceInboxEvent(slices.events, expiredEvent) },
  };
}

/** A refusal outcome. */
function refuse(error: CommandError): ReducerOutcome {
  return { status: 'refused', error };
}
