// Reading YouTube's answers into what the adapter keeps: the live's chat id from
// videos.list, and the Super Chats of one page of liveChatMessages.list. Zod at the
// boundary, loose on purpose: Google adds fields often, and only these are read.
import type { SuperChatEntry } from '@bajaovrlay/shared';
import { z } from 'zod';

// videos.list?part=liveStreamingDetails: the first item's active chat, when it has one.
const VideosAnswerSchema = z.object({
  items: z.array(
    z.object({
      liveStreamingDetails: z.object({ activeLiveChatId: z.string().min(1).optional() }).optional(),
    }),
  ),
});

/** What videos.list said about the video: missing, a live with no chat open, or its chat. */
export type ActiveLiveChatLookup =
  { kind: 'videoNotFound' } | { kind: 'noActiveLiveChat' } | { kind: 'found'; liveChatId: string };

/**
 * Reads the active chat of the video from a videos.list answer. A video that is not live,
 * a live that ended, or one with its chat off has no activeLiveChatId.
 */
export function readActiveLiveChatFromVideosAnswer(
  body: unknown,
): ActiveLiveChatLookup | undefined {
  const parsing = VideosAnswerSchema.safeParse(body);
  if (!parsing.success) {
    return undefined;
  }
  const video = parsing.data.items[0];
  if (video === undefined) {
    return { kind: 'videoNotFound' };
  }
  const liveChatId = video.liveStreamingDetails?.activeLiveChatId;
  if (liveChatId === undefined) {
    return { kind: 'noActiveLiveChat' };
  }
  return { kind: 'found', liveChatId };
}

// One message of liveChatMessages.list. Only a Super Chat's fields are read; every other
// type (an ordinary message, a sticker, a membership) is let through and dropped below.
const LiveChatMessageSchema = z.object({
  id: z.string().min(1),
  snippet: z.object({
    type: z.string(),
    publishedAt: z.string(),
    superChatDetails: z
      .object({
        amountMicros: z.coerce.number().int().min(0),
        currency: z.string().min(1),
        amountDisplayString: z.string().min(1),
        userComment: z.string().optional(),
        // Optional: YouTube's reference lists it, but a Super Chat without it is still paid.
        tier: z.number().int().min(0).optional(),
      })
      .optional(),
  }),
  authorDetails: z.object({ displayName: z.string() }),
});

// One page: the messages, where to read from next, how long to wait, and whether the live
// went offline (offlineAt appears only then). The page's own fields are checked strictly;
// each message is checked on its own in readLiveChatPage (gate 2 of PR #54).
const LiveChatMessagesAnswerSchema = z.object({
  items: z.array(z.unknown()),
  nextPageToken: z.string().optional(),
  pollingIntervalMillis: z.number().int().min(0).optional(),
  offlineAt: z.string().optional(),
});

/** What one page of the chat brought. */
export type LiveChatPage = {
  superChats: SuperChatEntry[];
  nextPageToken: string | undefined;
  /** How long YouTube asks to wait before the next read; 0 when it did not say. */
  pollingIntervalMs: number;
  /** True when YouTube says the live went offline: the chat will bring nothing more. */
  hasTheLiveGoneOffline: boolean;
  /** How many messages were not in the shape read here, and skipped; the adapter logs it. */
  skippedMessageCount: number;
};

/**
 * Reads one page of liveChatMessages.list, keeping only paid text messages
 * (`superChatEvent`): Super Stickers, memberships and gifted memberships are left out by
 * the brief, and ordinary messages are never shown. A viewer's empty comment is "".
 * A viewer whose name YouTube sends empty is named "Espectador" rather than dropped,
 * since they paid. Undefined when the answer is not a page at all.
 * Each message is checked on its own and one that fails is skipped (gate 2 of PR #54): one
 * odd message (a deletion notice, a field Google dropped) must not fail the whole page,
 * since nextPageToken only moves on with a good page, and every later poll would ask for
 * the same page again, fail, and spend 5 units, for the rest of the live. What could go
 * wrong: a Super Chat whose fields YouTube changed is skipped, logged by the adapter with their count.
 */
export function readLiveChatPage(body: unknown): LiveChatPage | undefined {
  const parsing = LiveChatMessagesAnswerSchema.safeParse(body);
  if (!parsing.success) {
    return undefined;
  }
  const superChats: SuperChatEntry[] = [];
  let skippedMessageCount = 0;
  for (const item of parsing.data.items) {
    const messageParsing = LiveChatMessageSchema.safeParse(item);
    if (!messageParsing.success) {
      skippedMessageCount += 1;
      continue;
    }
    const message = messageParsing.data;
    const details = message.snippet.superChatDetails;
    const publishedAtMs = Date.parse(message.snippet.publishedAt);
    const isSuperChat = message.snippet.type === 'superChatEvent' && details !== undefined;
    if (!isSuperChat || Number.isNaN(publishedAtMs)) {
      continue;
    }
    const authorName = message.authorDetails.displayName.trim();
    superChats.push({
      messageId: message.id,
      authorName: authorName === '' ? viewerWithoutAName : authorName,
      amountText: details.amountDisplayString,
      amountMicros: details.amountMicros,
      currency: details.currency,
      ...(details.tier === undefined ? {} : { tier: details.tier }),
      messageText: details.userComment ?? '',
      publishedAtMs,
    });
  }
  return {
    superChats,
    nextPageToken: parsing.data.nextPageToken,
    pollingIntervalMs: parsing.data.pollingIntervalMillis ?? 0,
    hasTheLiveGoneOffline: parsing.data.offlineAt !== undefined,
    skippedMessageCount,
  };
}

// The name shown for a paying viewer YouTube sends with no name.
const viewerWithoutAName = 'Espectador';
