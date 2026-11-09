// The adapter of kind `youtubeLiveChat` (BAJAOVRLAY-35): reads a YouTube live's chat with
// an API key and answers the superChats shape, the newest paid messages it has read.
import {
  readYouTubeVideoIdFromAddress,
  type SuperChatEntry,
  type SuperChatsShape,
  type YouTubeLiveChatConfig,
  YouTubeLiveChatConfigSchema,
  type YouTubeQuotaUsage,
} from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import { ptBR } from '../../../../core/messages/ptBR.js';
import type {
  DataSourceAdapter,
  DataSourcePollContext,
  PolledShapes,
} from '../dataSourceAdapter.js';
import type { ReadEnvironmentVariable } from '../httpJson/httpJsonRequestAddress.js';
import {
  readActiveLiveChatFromVideosAnswer,
  readLiveChatPage,
} from './superChatsFromLiveChatAnswer.js';
import { fetchYouTubeApi } from './youTubeApiRequests.js';
import {
  defaultYouTubeDailyUnitsBudget,
  parseYouTubeDailyUnitsBudget,
} from './youTubeDailyUnitsBudget.js';
import { readBrasiliaHourOfTheNextQuotaDay } from './youTubeQuotaDay.js';
import type { YouTubeQuotaLedger } from './youTubeQuotaLedger.js';

/** The variable the API key is read from, at every request. */
export const youTubeApiKeyVariableName = 'BAJAOVRLAY_YOUTUBE_API_KEY';

/** The variable the server's daily budget of units is read from. */
export const youTubeDailyUnitsVariableName = 'BAJAOVRLAY_YOUTUBE_DAILY_UNITS';

/** Google's price of each call, in quota units (YouTube Data API v3 documentation). */
const unitsOfVideosList = 1;
const unitsOfLiveChatMessagesList = 5;

/** How many Super Chats the answer keeps: plenty for an inbox that lists them once each. */
const superChatsKept = 50;

/**
 * The adapter, with what the poller adds for this kind: the quota spent today, which every
 * poll result of a YouTube source carries to the source's status.
 */
export type YouTubeLiveChatAdapter = DataSourceAdapter<YouTubeLiveChatConfig> & {
  readQuotaUsage: (nowMs: number) => YouTubeQuotaUsage;
};

/** What the adapter needs. */
export type YouTubeLiveChatAdapterOptions = {
  ledger: YouTubeQuotaLedger;
  logger: ServerLogger;
  readEnvironmentVariable: ReadEnvironmentVariable;
  /** The YouTube Data API's address; tests point it at a local fake. */
  youTubeApiBaseUrl: string;
};

/** What the adapter remembers of one live between polls (kept in memory only). */
type LiveChatReading = {
  /** The live's chat, found once with videos.list. */
  liveChatId: string | undefined;
  /** Where the next read starts, so a message is read once. */
  nextPageToken: string | undefined;
  /** The newest Super Chats read, oldest first. */
  superChats: SuperChatEntry[];
  /** When the list last changed: the shape's updatedAtMs, so a quiet chat is a no-op. */
  superChatsChangedAtMs: number;
  /** YouTube's wait: no request before this moment. */
  noRequestBeforeMs: number;
  /** The last good answer, handed back while YouTube's wait runs. */
  lastAnswer: PolledShapes | undefined;
};

/**
 * Builds the adapter. Per live (by video id) it finds the chat once (videos.list, 1 unit)
 * and then reads it from where the last read stopped (liveChatMessages.list, 5 units).
 * - YouTube's wait (pollingIntervalMillis): a poll before it has passed, such as
 *   "Atualizar agora" right after a read, answers the last answer with no request, so the
 *   source waits the larger of its own interval and YouTube's. Trade-off: that poll counts
 *   as good though nothing was asked; at worst the answer is YouTube's wait late.
 * - Quota: every request is counted in the ledger before it is sent (Google charges a
 *   refused request too); a request that would go past the budget is not sent and the poll
 *   fails with "Cota diária do YouTube esgotada; volta às 5h", so the source goes stale
 *   and keeps its last Super Chats (rule 4) until the next Pacific day.
 * - An ended, offline or vanished chat forgets the live, so the next poll looks for a new
 *   chat (a live restarted on the same address gets a new one).
 * - After a restart the memory is empty: the first read has no page token and YouTube
 *   answers its recent messages, so Super Chats paid while the server was down arrive;
 *   the inbox skips ids it already holds.
 */
export function createYouTubeLiveChatAdapter(
  options: YouTubeLiveChatAdapterOptions,
): YouTubeLiveChatAdapter {
  const { ledger, logger, readEnvironmentVariable, youTubeApiBaseUrl } = options;
  const readingsByVideoId = new Map<string, LiveChatReading>();

  /** The budget from the variable, or a pt-BR error naming it when it is not a number. */
  function readDailyUnitsBudget(): number {
    const parsing = parseYouTubeDailyUnitsBudget(
      readEnvironmentVariable(youTubeDailyUnitsVariableName),
    );
    if (!parsing.isValid) {
      throw new Error(ptBR.youTube.dailyUnitsNotANumber);
    }
    return parsing.dailyUnitsBudget;
  }

  /** Counts a request's units, or refuses it when it would go past the budget. */
  function spendUnitsOrRefuse(units: number, nowMs: number): void {
    const unitsAfter = ledger.readUnitsSpentToday(nowMs) + units;
    if (unitsAfter > readDailyUnitsBudget()) {
      throw new Error(ptBR.youTube.dailyBudgetSpent(readBrasiliaHourOfTheNextQuotaDay(nowMs)));
    }
    ledger.spendUnits(units, nowMs);
  }

  /** Finds the live's active chat with videos.list; throws the pt-BR reason when it has none. */
  async function findActiveLiveChatId(
    videoId: string,
    apiKey: string,
    context: DataSourcePollContext,
  ): Promise<string> {
    spendUnitsOrRefuse(unitsOfVideosList, context.readCurrentTime().getTime());
    const answer = await fetchYouTubeApi({
      baseUrl: youTubeApiBaseUrl,
      path: 'videos',
      parameters: [
        ['part', 'liveStreamingDetails'],
        ['id', videoId],
      ],
      apiKey,
      signal: context.signal,
      logger,
    });
    if (!answer.ok) {
      throw new Error(answer.error);
    }
    const lookup = readActiveLiveChatFromVideosAnswer(answer.body);
    if (lookup === undefined) {
      throw new Error(ptBR.youTube.answerNotUnderstood);
    }
    if (lookup.kind === 'videoNotFound') {
      throw new Error(ptBR.youTube.videoNotFound);
    }
    if (lookup.kind === 'noActiveLiveChat') {
      throw new Error(ptBR.youTube.noActiveLiveChat);
    }
    return lookup.liveChatId;
  }

  /** Reads the chat once from where the last read stopped, and updates what is remembered. */
  async function readTheChatOnce(
    videoId: string,
    reading: LiveChatReading,
    liveChatId: string,
    apiKey: string,
    context: DataSourcePollContext,
  ): Promise<PolledShapes> {
    spendUnitsOrRefuse(unitsOfLiveChatMessagesList, context.readCurrentTime().getTime());
    const parameters: Array<[string, string]> = [
      ['liveChatId', liveChatId],
      ['part', 'snippet,authorDetails'],
      ['maxResults', '200'],
      // Amounts written the Brazilian way: "R$ 50,00".
      ['hl', 'pt-BR'],
    ];
    if (reading.nextPageToken !== undefined) {
      parameters.push(['pageToken', reading.nextPageToken]);
    }
    const answer = await fetchYouTubeApi({
      baseUrl: youTubeApiBaseUrl,
      path: 'liveChat/messages',
      parameters,
      apiKey,
      signal: context.signal,
      logger,
    });
    if (!answer.ok) {
      const isTheChatGone =
        answer.reason === 'liveChatEnded' || answer.reason === 'liveChatNotFound';
      if (isTheChatGone) {
        readingsByVideoId.delete(videoId);
      }
      // A refused request (a page token YouTube no longer takes, gate 2 of PR #54) must
      // not be asked again at every poll for the rest of the live: the next poll reads the
      // chat afresh, and the inbox skips the ids it already holds.
      if (answer.httpStatus === 400) {
        reading.nextPageToken = undefined;
      }
      throw new Error(answer.error);
    }
    const page = readLiveChatPage(answer.body);
    if (page === undefined) {
      throw new Error(ptBR.youTube.answerNotUnderstood);
    }
    if (page.skippedMessageCount > 0) {
      logger.warn(
        { video_id: videoId, skipped_message_count: page.skippedMessageCount },
        'youtube chat messages skipped: not in the shape the adapter reads',
      );
    }
    if (page.hasTheLiveGoneOffline) {
      readingsByVideoId.delete(videoId);
      throw new Error(ptBR.youTube.liveChatEnded);
    }

    const nowMs = context.readCurrentTime().getTime();
    const superChatsAfter = addNewSuperChats(reading.superChats, page.superChats);
    // addNewSuperChats hands back the very same list when the page brought nothing new.
    const hasTheListChanged = superChatsAfter !== reading.superChats;
    if (hasTheListChanged || reading.lastAnswer === undefined) {
      reading.superChatsChangedAtMs = nowMs;
    }
    reading.superChats = superChatsAfter;
    reading.nextPageToken = page.nextPageToken;
    reading.noRequestBeforeMs = nowMs + page.pollingIntervalMs;
    const superChatsShape: SuperChatsShape = {
      updatedAtMs: reading.superChatsChangedAtMs,
      entries: reading.superChats,
    };
    reading.lastAnswer = { shapes: { superChats: superChatsShape } };
    return reading.lastAnswer;
  }

  return {
    kind: 'youtubeLiveChat',
    configSchema: YouTubeLiveChatConfigSchema,
    listProducedShapes: () => ['superChats'],
    readQuotaUsage: (nowMs) => ({
      unitsSpentToday: ledger.readUnitsSpentToday(nowMs),
      dailyUnitsBudget: readBudgetForTheStatus(readEnvironmentVariable),
    }),
    pollOnce: async (config, context) => {
      const videoId = readYouTubeVideoIdFromAddress(config.liveAddress);
      if (videoId === undefined) {
        // The config schema refuses such an address; only a database edited by hand has one.
        throw new Error(ptBR.youTube.videoNotFound);
      }
      const apiKey = (readEnvironmentVariable(youTubeApiKeyVariableName) ?? '').trim();
      if (apiKey === '') {
        throw new Error(ptBR.youTube.apiKeyMissing);
      }

      const reading = readingsByVideoId.get(videoId) ?? startAReading();
      readingsByVideoId.set(videoId, reading);
      const nowMs = context.readCurrentTime().getTime();
      const isYouTubesWaitRunning = nowMs < reading.noRequestBeforeMs;
      if (isYouTubesWaitRunning && reading.lastAnswer !== undefined) {
        return reading.lastAnswer;
      }

      const liveChatId =
        reading.liveChatId ?? (await findActiveLiveChatId(videoId, apiKey, context));
      reading.liveChatId = liveChatId;
      return readTheChatOnce(videoId, reading, liveChatId, apiKey, context);
    },
  };
}

/** A live not read yet: no chat, no page, nothing to wait for. */
function startAReading(): LiveChatReading {
  return {
    liveChatId: undefined,
    nextPageToken: undefined,
    superChats: [],
    superChatsChangedAtMs: 0,
    noRequestBeforeMs: 0,
    lastAnswer: undefined,
  };
}

/** The list with the page's Super Chats it did not hold added at its end, the newest 50 kept. */
function addNewSuperChats(
  superChatsKeptSoFar: SuperChatEntry[],
  superChatsOfThePage: SuperChatEntry[],
): SuperChatEntry[] {
  const messageIdsKept = new Set(superChatsKeptSoFar.map((superChat) => superChat.messageId));
  const newSuperChats = superChatsOfThePage.filter(
    (superChat) => !messageIdsKept.has(superChat.messageId),
  );
  if (newSuperChats.length === 0) {
    return superChatsKeptSoFar;
  }
  return [...superChatsKeptSoFar, ...newSuperChats].slice(-superChatsKept);
}

/**
 * The budget shown on the status. A variable that is not a number shows the default: the
 * poll itself fails naming the variable, which is what the operator must read.
 */
function readBudgetForTheStatus(readEnvironmentVariable: ReadEnvironmentVariable): number {
  const parsing = parseYouTubeDailyUnitsBudget(
    readEnvironmentVariable(youTubeDailyUnitsVariableName),
  );
  return parsing.isValid ? parsing.dailyUnitsBudget : defaultYouTubeDailyUnitsBudget;
}
