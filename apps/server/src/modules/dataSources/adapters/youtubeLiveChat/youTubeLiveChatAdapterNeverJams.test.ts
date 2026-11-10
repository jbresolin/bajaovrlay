/**
 * The YouTube live chat adapter never jams on one odd answer (apps/server)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) reads the chat page by page: each good page names the
 *   next one (nextPageToken). If one answer could stop the token from moving on, every
 *   later poll would ask for the same page, fail the same way and spend 5 quota units, for
 *   the rest of the live. Gate 2 of PR #54 found two such answers; these tests hold them off.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 standing in for YouTube):
 *   - A page with one message in a shape the adapter cannot read (a deletion notice with no
 *     author) still answers the good Super Chat beside it, and the next read goes on from
 *     that page's token.
 *   - A Super Chat with no tier is still read, with no tier.
 *   - A page token YouTube refuses (HTTP 400, "badRequest") fails the poll as a refused
 *     request, not as a refused key, and the next poll reads the chat afresh, with no token.
 *
 * What these tests deliberately do not cover:
 *   - The other refusals and the signal: youTubeLiveChatAdapterFailures.test.ts.
 *   - Good reads page after page: youTubeLiveChatAdapter.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildChatPage,
  buildGoogleError,
  buildSuperChatOfTorcidaCarnauba,
  createPollContextAt,
  createYouTubeAdapterForTests,
  enduroLiveAddress,
  enduroLiveChatId,
  startFakeYouTube,
} from './fakeYouTube.testSupport.js';

/** 12:02:30 in Brasília on Saturday 10 October 2026, during the enduro: the first poll. */
const firstPollMs = Date.parse('2026-10-10T15:02:30.000Z');

/** The enduro live's config, as the operator pasted it. */
const enduroLiveConfig = { liveAddress: enduroLiveAddress };

/** A notice that a moderator deleted a message: no author, no Super Chat fields. */
function buildDeletionNotice(): unknown {
  return {
    kind: 'youtube#liveChatMessage',
    id: 'aviso-apagada-0001',
    snippet: {
      type: 'messageDeletedEvent',
      liveChatId: enduroLiveChatId,
      publishedAt: '2026-10-10T15:02:20.000Z',
      hasDisplayContent: false,
      messageDeletedDetails: { deletedMessageId: 'mensagem-apagada-0009' },
    },
  };
}

/** Torcida Carnaúba's Super Chat with its tier taken out, as YouTube might send it. */
function buildSuperChatOfTorcidaCarnaubaWithNoTier(): unknown {
  const message = buildSuperChatOfTorcidaCarnauba() as {
    snippet: { superChatDetails: Record<string, unknown> };
  };
  delete message.snippet.superChatDetails.tier;
  return message;
}

/** The messageIds and tiers of the Super Chats one poll answered. */
function readSuperChatsAnswered(polled: { shapes: Record<string, unknown> }) {
  const superChats = polled.shapes.superChats as {
    entries: Array<{ messageId: string; tier?: number }>;
  };
  return superChats.entries.map((entry) => ({ messageId: entry.messageId, tier: entry.tier }));
}

/** Runs a poll that must fail, and gives back its pt-BR error message. */
async function captureThePollError(polling: Promise<unknown>): Promise<string> {
  try {
    await polling;
  } catch (pollError) {
    return pollError instanceof Error ? pollError.message : String(pollError);
  }
  throw new Error('the poll was expected to fail');
}

describe('a page with a message the adapter cannot read', () => {
  it('answers the good Super Chat beside it and goes on from its token', async () => {
    // Arrange: a page with a deletion notice next to Torcida Carnaúba's Super Chat, then an
    // empty page.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      {
        status: 200,
        body: buildChatPage({
          messages: [buildDeletionNotice(), buildSuperChatOfTorcidaCarnauba()],
          nextPageToken: 'pagina-test-0002',
          pollingIntervalMillis: 0,
        }),
      },
      { status: 200, body: buildChatPage({ messages: [], pollingIntervalMillis: 0 }) },
    );
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };

    // Act: poll twice, 30 s apart.
    const firstAnswer = await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: the Super Chat was answered, and the second read went on from the token.
    expect(readSuperChatsAnswered(firstAnswer), 'the good Super Chat must be kept').toEqual([
      { messageId: 'mensagem-carnauba-0001', tier: 4 },
    ]);
    const chatReads = fakeYouTube
      .readRequestsReceived()
      .filter((request) => request.path === '/youtube/v3/liveChat/messages');
    expect(
      chatReads[1]?.query.get('pageToken'),
      'the odd message must not keep the source on the same page',
    ).toBe('pagina-test-0002');
  });

  it('reads a Super Chat with no tier, with no tier', async () => {
    // Arrange: Torcida Carnaúba's Super Chat without its tier.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages({
      status: 200,
      body: buildChatPage({ messages: [buildSuperChatOfTorcidaCarnaubaWithNoTier()] }),
    });
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });

    // Act: poll once.
    const answer = await adapter.pollOnce(
      enduroLiveConfig,
      createPollContextAt({ nowMs: firstPollMs }),
    );

    // Assert: still read, the viewer paid.
    expect(readSuperChatsAnswered(answer), 'a missing tier must not drop a Super Chat').toEqual([
      { messageId: 'mensagem-carnauba-0001', tier: undefined },
    ]);
  });
});

describe('a page token YouTube refuses', () => {
  it('fails as a refused request, then reads the chat afresh with no token', async () => {
    // Arrange: a first page naming a token, YouTube refusing that token with a 400, then a
    // good page.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      {
        status: 200,
        body: buildChatPage({
          messages: [],
          nextPageToken: 'pagina-test-vencida-0002',
          pollingIntervalMillis: 0,
        }),
      },
      { status: 400, body: buildGoogleError(400, 'badRequest') },
      { status: 200, body: buildChatPage({ messages: [], pollingIntervalMillis: 0 }) },
    );
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };

    // Act: three polls, 30 s apart; the second fails.
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    const error = await captureThePollError(
      adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock)),
    );
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: a refused request, not a refused key; the third read had no token.
    expect(error, 'a 400 that is not about the key must not blame the key').toBe(
      'O YouTube recusou o pedido de leitura do chat; a próxima leitura lê o chat de novo do começo.',
    );
    const chatReads = fakeYouTube
      .readRequestsReceived()
      .filter((request) => request.path === '/youtube/v3/liveChat/messages');
    expect(
      chatReads.map((request) => request.query.get('pageToken')),
      'the refused token must be dropped, not asked again',
    ).toEqual([null, 'pagina-test-vencida-0002', null]);
  });
});
