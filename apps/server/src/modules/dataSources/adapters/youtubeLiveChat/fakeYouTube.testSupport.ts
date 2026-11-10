// Test support for the YouTube live chat source (BAJAOVRLAY-35): the fake API key, a real
// HTTP server on 127.0.0.1 standing in for the YouTube Data API v3, and builders of answers
// written to read like YouTube's own (fictional viewers, amounts in reais). The server and
// every connection close when the test ends.
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { onTestFinished } from 'vitest';

import { createLogger, type ServerLogger } from '../../../../core/logger/createLogger.js';
import type { DataSourcePollContext } from '../dataSourceAdapter.js';
import { createYouTubeLiveChatAdapter } from './youTubeLiveChatAdapter.js';
import { openYouTubeQuotaLedger } from './youTubeQuotaLedger.js';

/** The API key every YouTube test uses. Reads as fake on purpose; never a real key. */
export const fakeYouTubeApiKey = 'youtube-test-api-key-0001';

/** The live every test reads: "Baja SAE Brasil — Enduro ao vivo", video id BajaLive024. */
export const enduroLiveAddress = 'https://www.youtube.com/watch?v=BajaLive024';

/** The chat YouTube gives the enduro live. */
export const enduroLiveChatId = 'chat-do-enduro-ao-vivo-0001';

/** One answer of the fake: a JSON body with its status. */
export type FakeYouTubeAnswer = { status: number; body: unknown };

/** One request the fake received: its path and its query, key included, as sent. */
export type FakeYouTubeRequest = { path: string; query: URLSearchParams };

/** The running fake. */
export type FakeYouTube = {
  /** "http://127.0.0.1:<port>/youtube/v3", the base the adapter is pointed at. */
  baseUrl: string;
  /** How videos.list answers from now on. */
  answerVideos: (answer: FakeYouTubeAnswer) => void;
  /**
   * The pages liveChatMessages.list answers, in order, one per request; the last one is
   * answered again for every request after it.
   */
  answerChatPages: (...answers: FakeYouTubeAnswer[]) => void;
  /** Makes liveChatMessages.list never answer (to test the signal). */
  neverAnswerTheChat: () => void;
  readRequestsReceived: () => FakeYouTubeRequest[];
};

/** Starts the fake YouTube on a random port; it closes when the test ends. */
export async function startFakeYouTube(): Promise<FakeYouTube> {
  let videosAnswer: FakeYouTubeAnswer = { status: 200, body: buildVideosAnswerWithAnActiveChat() };
  let chatPagesLeft: FakeYouTubeAnswer[] = [{ status: 200, body: buildChatPage({ messages: [] }) }];
  let doesTheChatNeverAnswer = false;
  const requestsReceived: FakeYouTubeRequest[] = [];

  const server = createServer((request, response) => {
    const address = new URL(request.url ?? '/', 'http://127.0.0.1');
    requestsReceived.push({ path: address.pathname, query: address.searchParams });
    if (address.pathname === '/youtube/v3/videos') {
      writeJson(response, videosAnswer);
      return;
    }
    if (address.pathname === '/youtube/v3/liveChat/messages') {
      if (doesTheChatNeverAnswer) {
        return;
      }
      const page = chatPagesLeft.length > 1 ? chatPagesLeft.shift() : chatPagesLeft[0];
      writeJson(response, page ?? { status: 500, body: {} });
      return;
    }
    writeJson(response, { status: 404, body: buildGoogleError(404, 'notFound') });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}/youtube/v3`,
    answerVideos: (answer) => {
      videosAnswer = answer;
    },
    answerChatPages: (...answers) => {
      chatPagesLeft = answers;
    },
    neverAnswerTheChat: () => {
      doesTheChatNeverAnswer = true;
    },
    readRequestsReceived: () => [...requestsReceived],
  };
}

/** Writes one answer as JSON. */
function writeJson(response: ServerResponse, answer: FakeYouTubeAnswer): void {
  response.writeHead(answer.status, { 'content-type': 'application/json; charset=UTF-8' });
  response.end(JSON.stringify(answer.body));
}

/**
 * Builds the adapter as the server does, pointed at the fake, with the fake key, an
 * in-memory ledger unless a file is given, and a budget when one is given.
 */
export function createYouTubeAdapterForTests(options: {
  fakeYouTube: FakeYouTube;
  ledgerFilePath?: string;
  dailyUnitsBudget?: string;
  apiKey?: string | undefined;
  logger?: ServerLogger;
}) {
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const environment: Record<string, string | undefined> = {
    BAJAOVRLAY_YOUTUBE_API_KEY: 'apiKey' in options ? options.apiKey : fakeYouTubeApiKey,
    BAJAOVRLAY_YOUTUBE_DAILY_UNITS: options.dailyUnitsBudget,
  };
  return createYouTubeLiveChatAdapter({
    ledger: openYouTubeQuotaLedger({ ledgerFilePath: options.ledgerFilePath, logger }),
    logger,
    readEnvironmentVariable: (variableName) => environment[variableName],
    youTubeApiBaseUrl: options.fakeYouTube.baseUrl,
  });
}

/** A poll context on a clock the test holds, with a signal that never fires. */
export function createPollContextAt(clock: { nowMs: number }): DataSourcePollContext {
  return { readCurrentTime: () => new Date(clock.nowMs), signal: new AbortController().signal };
}

/** videos.list for the enduro live while it is on air: its active chat. */
export function buildVideosAnswerWithAnActiveChat(): unknown {
  return {
    kind: 'youtube#videoListResponse',
    etag: 'etag-do-video-ao-vivo',
    items: [
      {
        kind: 'youtube#video',
        etag: 'etag-do-video',
        id: 'BajaLive024',
        liveStreamingDetails: {
          actualStartTime: '2026-10-10T12:00:03Z',
          scheduledStartTime: '2026-10-10T12:00:00Z',
          concurrentViewers: '1843',
          activeLiveChatId: enduroLiveChatId,
        },
      },
    ],
    pageInfo: { totalResults: 1, resultsPerPage: 1 },
  };
}

/** videos.list for a video that is not live (or whose live ended): no active chat. */
export function buildVideosAnswerWithoutAnActiveChat(): unknown {
  return {
    kind: 'youtube#videoListResponse',
    items: [
      {
        kind: 'youtube#video',
        id: 'BajaLive024',
        liveStreamingDetails: {
          actualStartTime: '2026-10-09T12:00:03Z',
          actualEndTime: '2026-10-09T18:10:41Z',
        },
      },
    ],
    pageInfo: { totalResults: 1, resultsPerPage: 1 },
  };
}

/** One page of liveChatMessages.list, as YouTube shapes it. */
export function buildChatPage(page: {
  messages: unknown[];
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  offlineAt?: string;
}): unknown {
  return {
    kind: 'youtube#liveChatMessageListResponse',
    etag: 'etag-da-pagina',
    pollingIntervalMillis: page.pollingIntervalMillis ?? 5_000,
    pageInfo: { totalResults: page.messages.length, resultsPerPage: page.messages.length },
    nextPageToken: page.nextPageToken ?? 'pagina-seguinte-0001',
    ...(page.offlineAt === undefined ? {} : { offlineAt: page.offlineAt }),
    items: page.messages,
  };
}

/** A viewer's Super Chat, as liveChatMessages.list sends it (amountMicros as text). */
export function buildSuperChatMessage(superChat: {
  id: string;
  viewerName: string;
  amountText: string;
  amountMicros: number;
  tier: number;
  comment?: string;
  publishedAt: string;
}): unknown {
  return {
    kind: 'youtube#liveChatMessage',
    id: superChat.id,
    snippet: {
      type: 'superChatEvent',
      liveChatId: enduroLiveChatId,
      authorChannelId: `canal-de-${superChat.id}`,
      publishedAt: superChat.publishedAt,
      hasDisplayContent: true,
      displayMessage: `${superChat.amountText} de ${superChat.viewerName}: ${superChat.comment ?? ''}`,
      superChatDetails: {
        amountMicros: String(superChat.amountMicros),
        currency: 'BRL',
        amountDisplayString: superChat.amountText,
        ...(superChat.comment === undefined ? {} : { userComment: superChat.comment }),
        tier: superChat.tier,
      },
    },
    authorDetails: {
      channelId: `canal-de-${superChat.id}`,
      displayName: superChat.viewerName,
      isVerified: false,
      isChatOwner: false,
      isChatSponsor: false,
      isChatModerator: false,
    },
  };
}

/** An ordinary chat message: never a Super Chat. */
export function buildTextMessage(id: string, viewerName: string, text: string): unknown {
  return {
    kind: 'youtube#liveChatMessage',
    id,
    snippet: {
      type: 'textMessageEvent',
      liveChatId: enduroLiveChatId,
      publishedAt: '2026-10-10T15:02:30.000Z',
      hasDisplayContent: true,
      displayMessage: text,
      textMessageDetails: { messageText: text },
    },
    authorDetails: { displayName: viewerName, isChatOwner: false },
  };
}

/** A Super Sticker: paid, but left out by the brief. */
export function buildSuperStickerMessage(id: string, viewerName: string): unknown {
  return {
    kind: 'youtube#liveChatMessage',
    id,
    snippet: {
      type: 'superStickerEvent',
      liveChatId: enduroLiveChatId,
      publishedAt: '2026-10-10T15:02:45.000Z',
      hasDisplayContent: true,
      displayMessage: 'R$ 10,00 de figurinha',
      superStickerDetails: {
        superStickerMetadata: { stickerId: 'figurinha-carro', altText: 'Carro de corrida' },
        amountMicros: '10000000',
        currency: 'BRL',
        amountDisplayString: 'R$ 10,00',
        tier: 2,
      },
    },
    authorDetails: { displayName: viewerName },
  };
}

/** A refusal as Google writes it: the status, one error with its reason word. */
export function buildGoogleError(code: number, reason: string): unknown {
  return {
    error: {
      code,
      message: `Refusal with reason ${reason}.`,
      errors: [{ message: `Refusal with reason ${reason}.`, domain: 'youtube.liveChat', reason }],
    },
  };
}

/** The first Super Chat of the enduro: Torcida Carnaúba, R$ 50,00. */
export function buildSuperChatOfTorcidaCarnauba(): unknown {
  return buildSuperChatMessage({
    id: 'mensagem-carnauba-0001',
    viewerName: 'Torcida Carnaúba Baja',
    amountText: 'R$ 50,00',
    amountMicros: 50_000_000,
    tier: 4,
    comment: 'Força, Carnaúba! Mossoró está com vocês',
    publishedAt: '2026-10-10T15:02:11.000Z',
  });
}

/** The second: Ana do Paddock, R$ 5,00, no message. */
export function buildSuperChatOfAnaDoPaddock(): unknown {
  return buildSuperChatMessage({
    id: 'mensagem-ana-0002',
    viewerName: 'Ana do Paddock',
    amountText: 'R$ 5,00',
    amountMicros: 5_000_000,
    tier: 1,
    publishedAt: '2026-10-10T15:03:40.000Z',
  });
}
