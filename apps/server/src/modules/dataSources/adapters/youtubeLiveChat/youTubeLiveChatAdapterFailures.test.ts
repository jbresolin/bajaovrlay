/**
 * The YouTube live chat adapter when the chat cannot be read (apps/server)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) reads a live someone else runs: the live may not have
 *   started, its chat may be off, it may end, the key may be wrong. Each case must reach the
 *   operator as one pt-BR sentence on the source's row, never Google's English message, and
 *   a poll must stop when the poller calls it off.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 standing in for YouTube, real
 * fetch, refusals written like Google's own):
 *   - An ended chat, a disabled chat, a key Google refuses and a live gone offline each
 *     fail with the operator's sentence.
 *   - A live with no active chat says so; after an ended chat the chat is looked up again.
 *   - A missing key fails naming the variable, and nothing is sent.
 *   - The poll stops when its signal fires.
 *
 * What these tests deliberately do not cover:
 *   - Good reads: youTubeLiveChatAdapter.test.ts.
 *   - The quota: youTubeQuota.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildChatPage,
  buildGoogleError,
  buildVideosAnswerWithoutAnActiveChat,
  createPollContextAt,
  createYouTubeAdapterForTests,
  enduroLiveAddress,
  startFakeYouTube,
} from './fakeYouTube.testSupport.js';

/** 12:02:30 in Brasília on Saturday 10 October 2026, during the enduro: the first poll. */
const firstPollMs = Date.parse('2026-10-10T15:02:30.000Z');

/** The enduro live's config, as the operator pasted it. */
const enduroLiveConfig = { liveAddress: enduroLiveAddress };

/** Runs a poll that must fail, and gives back its pt-BR error message. */
async function captureThePollError(polling: Promise<unknown>): Promise<string> {
  try {
    await polling;
  } catch (pollError) {
    return pollError instanceof Error ? pollError.message : String(pollError);
  }
  throw new Error('the poll was expected to fail');
}

describe('when the chat cannot be read', () => {
  const refusalScenarios = [
    // The live ended between two reads: YouTube says so with liveChatEnded.
    {
      name: 'an ended chat',
      answer: { status: 403, body: buildGoogleError(403, 'liveChatEnded') },
      expectedError: 'A transmissão terminou: o chat ao vivo foi encerrado.',
    },
    // The channel switched the chat off for this live.
    {
      name: 'a disabled chat',
      answer: { status: 403, body: buildGoogleError(403, 'liveChatDisabled') },
      expectedError: 'O chat ao vivo está desativado nesta transmissão.',
    },
    // The key was deleted or restricted to another API.
    {
      name: 'a key Google refuses',
      answer: { status: 400, body: buildGoogleError(400, 'keyInvalid') },
      expectedError:
        'Chave da API do YouTube recusada: confira BAJAOVRLAY_YOUTUBE_API_KEY e se a YouTube Data API v3 está ativada no projeto.',
    },
    // The live went offline: the page says when, and no message will come again.
    {
      name: 'a live gone offline',
      answer: {
        status: 200,
        body: buildChatPage({ messages: [], offlineAt: '2026-10-10T18:10:41Z' }),
      },
      expectedError: 'A transmissão terminou: o chat ao vivo foi encerrado.',
    },
  ];

  it.each(refusalScenarios)(
    'fails with the pt-BR reason for $name',
    async ({ answer, expectedError }) => {
      // Arrange: YouTube refusing the chat read as in the row.
      const fakeYouTube = await startFakeYouTube();
      fakeYouTube.answerChatPages(answer);
      const adapter = createYouTubeAdapterForTests({ fakeYouTube });

      // Act: poll once.
      const error = await captureThePollError(
        adapter.pollOnce(enduroLiveConfig, createPollContextAt({ nowMs: firstPollMs })),
      );

      // Assert: the operator's sentence, never Google's English message.
      expect(error, 'the operator must read the pt-BR reason').toBe(expectedError);
    },
  );

  it('says the live has no active chat when videos.list gives none', async () => {
    // Arrange: a video whose live is over.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerVideos({ status: 200, body: buildVideosAnswerWithoutAnActiveChat() });
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(enduroLiveConfig, createPollContextAt({ nowMs: firstPollMs })),
    );

    // Assert: the brief's sentence.
    expect(error, 'a live with no chat must say so').toBe(
      'Esta transmissão não tem chat ao vivo ativo.',
    );
  });

  it('looks the chat up again after it ended, for a live restarted on the same address', async () => {
    // Arrange: a chat that ends at the first read, then answers.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      { status: 403, body: buildGoogleError(403, 'liveChatEnded') },
      { status: 200, body: buildChatPage({ messages: [] }) },
    );
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: firstPollMs };

    // Act: the failing poll, then another 30 s later.
    await captureThePollError(adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock)));
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: videos.list was asked again before the second read.
    const paths = fakeYouTube.readRequestsReceived().map((request) => request.path);
    expect(paths, 'an ended chat must be looked up again').toEqual([
      '/youtube/v3/videos',
      '/youtube/v3/liveChat/messages',
      '/youtube/v3/videos',
      '/youtube/v3/liveChat/messages',
    ]);
  });

  it('fails naming the variable when the server has no key, sending nothing', async () => {
    // Arrange: a server with BAJAOVRLAY_YOUTUBE_API_KEY unset.
    const fakeYouTube = await startFakeYouTube();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube, apiKey: undefined });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(enduroLiveConfig, createPollContextAt({ nowMs: firstPollMs })),
    );

    // Assert: the variable is named, and YouTube was never asked.
    expect(error, 'a missing key must be named').toBe(
      'Falta a chave BAJAOVRLAY_YOUTUBE_API_KEY no servidor: veja docs/youtube.md para criar uma.',
    );
    expect(fakeYouTube.readRequestsReceived(), 'no request may go without a key').toEqual([]);
  });

  it('stops waiting when the poll is called off', async () => {
    // Arrange: a chat that never answers, and a poll the test can call off.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.neverAnswerTheChat();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const abortController = new AbortController();
    const context = {
      readCurrentTime: () => new Date(firstPollMs),
      signal: abortController.signal,
    };

    // Act: start the poll, then call it off once the chat read is in flight.
    const polling = adapter.pollOnce(enduroLiveConfig, context);
    await expect.poll(() => fakeYouTube.readRequestsReceived().length, { timeout: 2_000 }).toBe(2);
    abortController.abort();

    // Assert: the poll rejects at once instead of hanging.
    await expect(polling, 'a called-off poll must reject').rejects.toThrow();
  });
});
