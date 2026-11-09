import { z } from 'zod';

import { ptBRYouTubeLiveChat } from './ptBRYouTubeLiveChat.js';

/**
 * The shortest poll interval of a YouTube live chat source: 10 s. Every poll spends 5 of the
 * day's 10 000 quota units, so faster would run the quota out before the racing ends.
 */
export const youTubeLiveChatShortestPollIntervalMs = 10_000;

/** The interval a new YouTube live chat source is offered with: 30 s, about 6 000 units in 10 h. */
export const youTubeLiveChatDefaultPollIntervalMs = 30_000;

// A YouTube video id: eleven letters, digits, "-" or "_". Every address form ends in one.
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id in a live's address as the operator pastes it, or undefined when the text
 * is not one of the three forms YouTube gives out:
 * - `https://www.youtube.com/watch?v=<id>` (also with more query parameters after it);
 * - `https://youtu.be/<id>` (the "Compartilhar" button);
 * - `https://www.youtube.com/live/<id>` (the live's own page).
 * The protocol and the `www.` or `m.` may be left out. Written as steps, not one pattern,
 * so each form can be read on its own.
 */
export function readYouTubeVideoIdFromAddress(address: string): string | undefined {
  let rest = address.trim();
  if (rest.startsWith('https://')) {
    rest = rest.slice('https://'.length);
  } else if (rest.startsWith('http://')) {
    rest = rest.slice('http://'.length);
  }
  if (rest.startsWith('www.')) {
    rest = rest.slice('www.'.length);
  } else if (rest.startsWith('m.')) {
    rest = rest.slice('m.'.length);
  }

  let candidate: string | undefined;
  if (rest.startsWith('youtu.be/')) {
    candidate = rest.slice('youtu.be/'.length);
  } else if (rest.startsWith('youtube.com/live/')) {
    candidate = rest.slice('youtube.com/live/'.length);
  } else if (rest.startsWith('youtube.com/watch?')) {
    const queryText = rest.slice('youtube.com/watch?'.length);
    const videoParameter = queryText.split('&').find((parameter) => parameter.startsWith('v='));
    candidate = videoParameter?.slice('v='.length);
  }
  if (candidate === undefined) {
    return undefined;
  }

  // What may follow the id: "?si=…" after youtu.be or /live/, "#t=…", a closing "/".
  const videoId = candidate.split(/[?&#/]/)[0] ?? '';
  return videoIdPattern.test(videoId) ? videoId : undefined;
}

/**
 * How a YouTube live chat source is set up (BAJAOVRLAY-35): only the live's address, as
 * pasted. The API key is never here: it is read from BAJAOVRLAY_YOUTUBE_API_KEY at each
 * request, so it never reaches a slice, a recording or the event log. The poll interval is
 * the source's own pollIntervalMs, from 10 s (youTubeLiveChatShortestPollIntervalMs).
 */
export const YouTubeLiveChatConfigSchema = z.object({
  liveAddress: z
    .string()
    .trim()
    .refine((address) => readYouTubeVideoIdFromAddress(address) !== undefined, {
      message: ptBRYouTubeLiveChat.configReasons.notALiveAddress,
    }),
});

/** A YouTube live chat config after parsing. */
export type YouTubeLiveChatConfig = z.infer<typeof YouTubeLiveChatConfigSchema>;

/**
 * How many quota units the server's YouTube key spent today (Pacific time, when Google
 * resets it) against the budget it stops at (BAJAOVRLAY_YOUTUBE_DAILY_UNITS). Shown on the
 * source's status; the key's quota is one for every YouTube source of the server.
 */
export const YouTubeQuotaUsageSchema = z.object({
  unitsSpentToday: z.number().int().min(0),
  dailyUnitsBudget: z.number().int().positive(),
});

/** A quota usage that has passed YouTubeQuotaUsageSchema. */
export type YouTubeQuotaUsage = z.infer<typeof YouTubeQuotaUsageSchema>;
