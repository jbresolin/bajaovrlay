/**
 * The YouTube live chat adapter (apps/server)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) reads a live's chat with an API key and answers the
 *   superChats shape: the paid messages a viewer sent, which the event inbox then lists for
 *   Dados to approve. It finds the live's chat once (videos.list), then reads the chat from
 *   where it last stopped (liveChatMessages.list), never faster than YouTube asks.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 standing in for YouTube, real
 * fetch, answers written like YouTube's own):
 *   - The chat id is looked up once, then every read names it and the page token.
 *   - Only Super Chats are kept: ordinary messages and Super Stickers are dropped; a Super
 *     Chat with no comment keeps an empty message; new pages add to the list, once each.
 *   - YouTube's pollingIntervalMillis is honoured: a poll before it has passed answers the
 *     last answer and sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - Refusals, a missing key and the signal: youTubeLiveChatAdapterFailures.test.ts.
 *   - The quota and its ledger: youTubeQuota.test.ts.
 *   - That the key never reaches a log, slice, recording or event row:
 *     youTubeKeyNeverAppears.test.ts in the data-source module.
 */
import { describe, expect, it } from 'vitest';

import {
  buildChatPage,
  buildSuperChatMessage,
  buildSuperChatOfAnaDoPaddock,
  buildSuperChatOfTorcidaCarnauba,
  buildSuperStickerMessage,
  buildTextMessage,
  createPollContextAt,
  createYouTubeAdapterForTests,
  enduroLiveAddress,
  enduroLiveChatId,
  fakeYouTubeApiKey,
  startFakeYouTube,
} from './fakeYouTube.testSupport.js';

/** 12:02:30 in Brasília on Saturday 10 October 2026, during the enduro: the first poll. */
const firstPollMs = Date.parse('2026-10-10T15:02:30.000Z');

/** The enduro live's config, as the operator pasted it. */
const enduroLiveConfig = { liveAddress: enduroLiveAddress };

describe('reading the live chat', () => {
  it('looks the chat up once, then reads it from the last page token', async () => {
    // Arrange: YouTube with the enduro's chat answering two pages, and the adapter.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      {
        status: 200,
        body: buildChatPage({
          messages: [],
          nextPageToken: 'pagina-test-0002',
          pollingIntervalMillis: 0,
        }),
      },
      {
        status: 200,
        body: buildChatPage({
          messages: [],
          nextPageToken: 'pagina-test-0003',
          pollingIntervalMillis: 0,
        }),
      },
    );
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };

    // Act: poll twice, 30 s apart.
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: one videos.list, then two chat reads naming the chat, the second with the token.
    const requests = fakeYouTube.readRequestsReceived();
    expect(
      requests.map((request) => request.path),
      'the chat must be looked up once, then read twice',
    ).toEqual([
      '/youtube/v3/videos',
      '/youtube/v3/liveChat/messages',
      '/youtube/v3/liveChat/messages',
    ]);
    expect(requests[0]?.query.get('id'), 'videos.list must name the live').toBe('BajaLive024');
    expect(requests[0]?.query.get('part'), 'videos.list must ask for the live details').toBe(
      'liveStreamingDetails',
    );
    expect(requests[1]?.query.get('liveChatId'), 'the chat read must name the chat').toBe(
      enduroLiveChatId,
    );
    expect(
      requests[1]?.query.get('pageToken'),
      'the first read must start with no token',
    ).toBeNull();
    expect(requests[2]?.query.get('pageToken'), 'the second read must go on from the first').toBe(
      'pagina-test-0002',
    );
    expect(requests[1]?.query.get('hl'), 'amounts must be asked in Brazilian format').toBe('pt-BR');
    expect(requests[1]?.query.get('key'), 'the key goes in the request').toBe(fakeYouTubeApiKey);
  });

  it('keeps only Super Chats, an empty comment as an empty message', async () => {
    // Arrange: a page with a Super Chat, an ordinary message, a sticker and a silent Super Chat.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages({
      status: 200,
      body: buildChatPage({
        messages: [
          buildSuperChatOfTorcidaCarnauba(),
          buildTextMessage('mensagem-comum-0003', 'Marcos Torcedor', 'Que corrida!'),
          buildSuperStickerMessage('figurinha-0004', 'Lia Fã de Baja'),
          buildSuperChatOfAnaDoPaddock(),
        ],
      }),
    });
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });

    // Act: poll once.
    const answer = await adapter.pollOnce(
      enduroLiveConfig,
      createPollContextAt({ nowMs: firstPollMs }),
    );

    // Assert: exactly the two Super Chats, as the shape writes them.
    expect(answer.shapes.superChats, 'only the two paid text messages may be kept').toEqual({
      updatedAtMs: firstPollMs,
      entries: [
        {
          messageId: 'mensagem-carnauba-0001',
          authorName: 'Torcida Carnaúba Baja',
          amountText: 'R$ 50,00',
          amountMicros: 50_000_000,
          currency: 'BRL',
          tier: 4,
          messageText: 'Força, Carnaúba! Mossoró está com vocês',
          publishedAtMs: Date.parse('2026-10-10T15:02:11.000Z'),
        },
        {
          messageId: 'mensagem-ana-0002',
          authorName: 'Ana do Paddock',
          amountText: 'R$ 5,00',
          amountMicros: 5_000_000,
          currency: 'BRL',
          tier: 1,
          messageText: '',
          publishedAtMs: Date.parse('2026-10-10T15:03:40.000Z'),
        },
      ],
    });
  });

  it('adds a later page to the list, and a quiet page leaves the answer as it was', async () => {
    // Arrange: a first page with Carnaúba's Super Chat, a second with Ana's, a third empty.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      {
        status: 200,
        body: buildChatPage({
          messages: [buildSuperChatOfTorcidaCarnauba()],
          pollingIntervalMillis: 0,
        }),
      },
      {
        status: 200,
        body: buildChatPage({
          messages: [buildSuperChatOfAnaDoPaddock()],
          pollingIntervalMillis: 0,
        }),
      },
      { status: 200, body: buildChatPage({ messages: [], pollingIntervalMillis: 0 }) },
    );
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };

    // Act: three polls, 30 s apart.
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    const secondAnswer = await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    const thirdAnswer = await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: both Super Chats, oldest first; the quiet poll answers the same shape.
    expect(
      secondAnswer.shapes.superChats,
      'the second page must add Ana after Carnaúba, dated at the second poll',
    ).toMatchObject({
      updatedAtMs: firstPollMs + 30_000,
      entries: [{ messageId: 'mensagem-carnauba-0001' }, { messageId: 'mensagem-ana-0002' }],
    });
    expect(thirdAnswer.shapes, 'a page with no Super Chat must change nothing').toEqual(
      secondAnswer.shapes,
    );
  });

  it('keeps the newest 50 Super Chats', async () => {
    // Arrange: one page with 52 Super Chats of R$ 2,00, a second apart.
    const fakeYouTube = await startFakeYouTube();
    const messages = Array.from({ length: 52 }, (_, index) =>
      buildSuperChatMessage({
        id: `mensagem-da-chuva-${String(index + 1).padStart(4, '0')}`,
        viewerName: 'Torcida da Chuva',
        amountText: 'R$ 2,00',
        amountMicros: 2_000_000,
        tier: 1,
        comment: `Mensagem ${String(index + 1)}`,
        publishedAt: new Date(firstPollMs - 60_000 + index * 1_000).toISOString(),
      }),
    );
    fakeYouTube.answerChatPages({ status: 200, body: buildChatPage({ messages }) });
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });

    // Act: poll once.
    const answer = await adapter.pollOnce(
      enduroLiveConfig,
      createPollContextAt({ nowMs: firstPollMs }),
    );

    // Assert: the 3rd to the 52nd, so the oldest two were let go.
    const entries = answer.shapes.superChats as { entries: Array<{ messageId: string }> };
    expect(entries.entries, 'at most 50 Super Chats are kept').toHaveLength(50);
    expect(entries.entries[0]?.messageId, 'the oldest kept must be the third').toBe(
      'mensagem-da-chuva-0003',
    );
  });
});

describe("YouTube's wait between reads", () => {
  it('answers the last answer without a request while pollingIntervalMillis runs', async () => {
    // Arrange: a page that asks for 20 s before the next read.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages({
      status: 200,
      body: buildChatPage({
        messages: [buildSuperChatOfTorcidaCarnauba()],
        pollingIntervalMillis: 20_000,
      }),
    });
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };
    const firstAnswer = await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Act: poll again 10 s later ("Atualizar agora"), then 21 s after the first.
    clock.nowMs = firstPollMs + 10_000;
    const earlyAnswer = await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    const requestsAfterTheEarlyPoll = fakeYouTube.readRequestsReceived().length;
    clock.nowMs = firstPollMs + 21_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: the early poll asked nothing and answered the same; the later one read again.
    expect(earlyAnswer, 'a poll inside the wait must answer the last answer').toBe(firstAnswer);
    expect(requestsAfterTheEarlyPoll, 'a poll inside the wait must send nothing').toBe(2);
    expect(
      fakeYouTube.readRequestsReceived().length,
      'a poll after the wait must read the chat again',
    ).toBe(3);
  });
});
