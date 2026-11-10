// The detector of new Super Chats (BAJAOVRLAY-35): a viewer's paid message the previous
// answer of the YouTube source did not list.
import type { DetectedEvent, SuperChatEntry, SuperChatsShape } from '@bajaovrlay/shared';

import type { EventDetectionMoment } from './eventDetectionMoment.js';

/** How far back a first poll looks: older Super Chats are taken as already seen. */
export const firstPollWindowMs = 15 * 60_000;

/**
 * Lists one superChat event per Super Chat of `next` that is news, in the order `next`
 * lists them. News means not listed in `previous`, and published at or after a cutoff:
 * - no previous answer (a first poll: the source never polled, just turned on, or its
 *   address changed): the last 15 minutes before this poll;
 * - a previous answer with Super Chats: its oldest one. The adapter reads more history
 *   afresh after a restart than the saved answer kept (it keeps the newest 50), and one
 *   older than all it kept was seen and rolled out, not missed;
 * - an empty previous answer: 15 minutes before it was made, as if it were the first poll.
 * Trade-off, João's two promises: a Super Chat paid while the server was down is never
 * lost (it is newer than the saved answer), and switching a source on never floods the
 * inbox with an hour of chat. What could go wrong: a first poll more than 15 minutes after
 * a Super Chat (a source switched on late in the live) skips it on purpose; and one older
 * than the saved answer's oldest but never in it (only possible if YouTube answered it
 * late) is lost.
 * The event id is `<sourceId>:superChat:<YouTube message id>`, so a Super Chat read again
 * after a restart is the same event and the inbox skips it.
 */
export function detectNewSuperChats(
  previous: SuperChatsShape | undefined,
  next: SuperChatsShape,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  const messageIdsListedBefore = new Set(previous?.entries.map((entry) => entry.messageId) ?? []);
  const cutoffMs = findCutoffOfNews(previous, moment);
  const newSuperChats = next.entries.filter(
    (entry) => !messageIdsListedBefore.has(entry.messageId) && entry.publishedAtMs >= cutoffMs,
  );
  return newSuperChats.map((superChat) => buildSuperChatEvent(superChat, moment));
}

/** The moment before which a Super Chat is not news (see detectNewSuperChats). */
function findCutoffOfNews(
  previous: SuperChatsShape | undefined,
  moment: EventDetectionMoment,
): number {
  if (previous === undefined) {
    return moment.detectedAtMs - firstPollWindowMs;
  }
  const publishedMomentsBefore = previous.entries.map((entry) => entry.publishedAtMs);
  if (publishedMomentsBefore.length === 0) {
    return previous.updatedAtMs - firstPollWindowMs;
  }
  return Math.min(...publishedMomentsBefore);
}

/** The event of one Super Chat: the viewer, the amount and the message; no car. */
function buildSuperChatEvent(
  superChat: SuperChatEntry,
  moment: EventDetectionMoment,
): DetectedEvent {
  return {
    eventId: `${moment.sourceId}:superChat:${superChat.messageId}`,
    kind: 'superChat',
    sourceId: moment.sourceId,
    detectedAtMs: moment.detectedAtMs,
    payload: {
      authorName: superChat.authorName,
      amountText: superChat.amountText,
      messageText: superChat.messageText,
    },
  };
}
