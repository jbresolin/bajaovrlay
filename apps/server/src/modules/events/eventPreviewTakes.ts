import type { CommandError, Instance } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';
import {
  findInboxEvent,
  findRuleOfKind,
  isEventWaiting,
  isSuperChatAwaitingApproval,
  readMomentMs,
  readMomentTheWaitCountsFrom,
} from './reducers/inboxEventChanges.js';

/**
 * Why a preview of an event cannot be taken ("Tomar", "Tomar tudo"), or undefined when it
 * can (or the preview shows no event). Its event must still wait, and be within its rule's
 * maximum wait, as "No ar" would require: an event dismissed, already shown, or too old
 * never reaches the air through its preview (gate 2 of PR #22), and neither does a Super
 * Chat no person approved yet (BAJAOVRLAY-35). Core's preview promotion
 * calls it for every preview it takes.
 */
export function findRefusalOfTakingAPreviewOfAnEvent(
  slices: SlicesChangedByCommands,
  previewInstance: Instance,
  isoMomentOfTheTake: string,
): CommandError | undefined {
  if (previewInstance.eventId === undefined) {
    return undefined;
  }
  const event = findInboxEvent(slices.events, previewInstance.eventId);
  if (event === undefined) {
    return { code: 'EVENT_NOT_FOUND', message: ptBR.eventErrors.eventNotFound };
  }
  if (!isEventWaiting(event)) {
    return { code: 'EVENT_NOT_WAITING', message: ptBR.eventErrors.eventNotWaiting(event.status) };
  }
  if (isSuperChatAwaitingApproval(event)) {
    return { code: 'EVENT_NOT_APPROVED', message: ptBR.eventErrors.superChatNotApproved };
  }
  const maxAgeMs = findRuleOfKind(slices.eventRules, event.kind)?.maxAgeMs ?? null;
  const ageMs = readMomentMs(isoMomentOfTheTake) - readMomentTheWaitCountsFrom(event);
  if (maxAgeMs !== null && ageMs > maxAgeMs) {
    return { code: 'EVENT_NOT_WAITING', message: ptBR.eventErrors.eventTooOld };
  }
  return undefined;
}
