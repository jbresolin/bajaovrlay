/**
 * The YouTube API key never leaves the request (apps/server)
 *
 * What this module is for:
 *   The YouTube source (BAJAOVRLAY-35) sends BAJAOVRLAY_YOUTUBE_API_KEY with every request
 *   to Google, in the address, as Google asks for an API key. Anyone who reads a log line,
 *   a slice on a page, a recording file or the history page must never see it: a key on a
 *   screen share or in a backup lets anyone spend the channel's quota.
 *
 * What these tests prove (a real store on a temporary SQLite file, the real poller with
 * Node's timers, the real recorder, the server's own adapters, and a fake YouTube on
 * 127.0.0.1), with a failing poll and a good one, both recorded:
 *   - the fake YouTube did receive the key (so the search below is not vacuous);
 *   - no log line at any level, no slice, no line of the recording and no event-log row
 *     holds `youtube-test-api-key-0001`;
 *   - the source's status shows the quota spent, which is how the operator follows it.
 *   - redactTheKeyInAnAddress replaces the key's value, wherever it is in the address.
 *
 * What these tests deliberately do not cover:
 *   - Each refusal's sentence: adapters/youtubeLiveChat/youTubeLiveChatAdapter.test.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DataSource } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import {
  buildChatPage,
  buildGoogleError,
  buildSuperChatOfTorcidaCarnauba,
  enduroLiveAddress,
  fakeYouTubeApiKey,
  startFakeYouTube,
} from './adapters/youtubeLiveChat/fakeYouTube.testSupport.js';
import { redactTheKeyInAnAddress } from './adapters/youtubeLiveChat/youTubeApiRequests.js';
import { operatorActor } from './enduroSimulatorCommands.testSupport.js';
import { startDataSourcePoller } from './poller.js';
import { startRecorderWatchingAStore } from './recorder.testSupport.js';

/** Reads the YouTube source as the store holds it now. */
function readTheYouTubeSource(stateStore: StateStore): DataSource {
  const source = stateStore
    .readAllSlices()
    .dataSources.find((each) => each.kind === 'youtubeLiveChat');
  if (source === undefined) {
    throw new Error('the YouTube source must have been made');
  }
  return source;
}

/** Every line of every recording file under the folder, as one text. */
function readEveryRecordingLine(recordingsFolder: string): string {
  const texts: string[] = [];
  for (const entry of readdirSync(recordingsFolder, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      texts.push(readFileSync(join(entry.parentPath, entry.name), 'utf8'));
    }
  }
  return texts.join('\n');
}

describe('the YouTube API key', () => {
  it('reaches YouTube and nothing else, through a failed poll and a good one', async () => {
    // Arrange: a fake YouTube that refuses the first read and then answers a Super Chat;
    // the store, the recorder and the real poller with the server's adapters, logging
    // every level, the key set as the server's environment.
    const fakeYouTube = await startFakeYouTube();
    fakeYouTube.answerChatPages(
      { status: 403, body: buildGoogleError(403, 'forbidden') },
      {
        status: 200,
        body: buildChatPage({
          messages: [buildSuperChatOfTorcidaCarnauba()],
          pollingIntervalMillis: 0,
        }),
      },
    );
    const { stateStore, recordingsFolder, timers } = startRecorderWatchingAStore();
    const { logger, readRecordedLines } = createRecordingLogger();
    const poller = startDataSourcePoller({
      stateStore,
      logger,
      adapters: createDataSourceAdapters({
        recordingsFolder,
        logger,
        readSourceEnvironmentVariable: (variableName) =>
          variableName === 'BAJAOVRLAY_YOUTUBE_API_KEY' ? fakeYouTubeApiKey : undefined,
        youTubeApiBaseUrl: fakeYouTube.baseUrl,
      }),
    });
    onTestFinished(() => poller.stop());

    // Act: make "YouTube — Enduro ao vivo", turn it on recording, let the first poll fail,
    // press "Atualizar agora" for the good one.
    stateStore.applyCommand(
      {
        type: 'createDataSource',
        label: 'YouTube — Enduro ao vivo',
        kind: 'youtubeLiveChat',
        config: { liveAddress: enduroLiveAddress },
        pollIntervalMs: 30_000,
      },
      operatorActor,
    );
    const sourceId = readTheYouTubeSource(stateStore).id;
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId, isEnabled: true },
      operatorActor,
    );
    stateStore.applyCommand({ type: 'startRecording', sourceId }, operatorActor);
    await vi.waitFor(
      () => {
        expect(readTheYouTubeSource(stateStore).status.lastError).not.toBeNull();
      },
      { timeout: 5_000, interval: 20 },
    );
    stateStore.applyCommand({ type: 'pollDataSourceNow', sourceId }, operatorActor);
    await vi.waitFor(
      () => {
        expect(readTheYouTubeSource(stateStore).status.lastError).toBeNull();
      },
      { timeout: 5_000, interval: 20 },
    );
    timers.runEveryDeferredTimer();

    // Assert: the key went to YouTube, and appears in no log, slice, recording or event row.
    const keysSent = fakeYouTube.readRequestsReceived().map((request) => request.query.get('key'));
    expect(keysSent, 'every request to YouTube must carry the key').toContain(fakeYouTubeApiKey);
    const allSlices = stateStore.readAllSlices();
    expect(JSON.stringify(readRecordedLines()), 'no log line may hold the key').not.toContain(
      fakeYouTubeApiKey,
    );
    expect(
      JSON.stringify(readRecordedLines()),
      'the requests must be logged with the key redacted',
    ).toContain('key=***');
    expect(JSON.stringify(allSlices), 'no slice may hold the key').not.toContain(fakeYouTubeApiKey);
    expect(JSON.stringify(allSlices.eventLog), 'no event-log row may hold the key').not.toContain(
      fakeYouTubeApiKey,
    );
    const recordingText = readEveryRecordingLine(recordingsFolder);
    expect(recordingText, 'the recording must hold the good poll').toContain(
      'mensagem-carnauba-0001',
    );
    expect(recordingText, 'no recorded line may hold the key').not.toContain(fakeYouTubeApiKey);
    expect(
      readTheYouTubeSource(stateStore).status.youTubeQuota,
      'the status must show the units spent: a look-up and two reads',
    ).toEqual({ unitsSpentToday: 11, dailyUnitsBudget: 9_000 });
  });
});

describe('redactTheKeyInAnAddress', () => {
  const addressScenarios = [
    // The key last, as the adapter sends it.
    {
      name: 'redacts a key at the end',
      address: `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=BajaLive024&key=${fakeYouTubeApiKey}`,
      expected:
        'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=BajaLive024&key=***',
    },
    // The key first, with parameters after it.
    {
      name: 'redacts a key followed by other parameters',
      address: `https://www.googleapis.com/youtube/v3/liveChat/messages?key=${fakeYouTubeApiKey}&part=snippet`,
      expected: 'https://www.googleapis.com/youtube/v3/liveChat/messages?key=***&part=snippet',
    },
    // An address with no key is left as it is.
    {
      name: 'leaves an address without a key alone',
      address: 'https://www.googleapis.com/youtube/v3/videos?id=BajaLive024',
      expected: 'https://www.googleapis.com/youtube/v3/videos?id=BajaLive024',
    },
  ];

  it.each(addressScenarios)('$name', ({ address, expected }) => {
    // Arrange: the address in the row.

    // Act: redact it.
    const redacted = redactTheKeyInAnAddress(address);

    // Assert: the key's value is gone, everything else kept.
    expect(redacted, 'only the key may be replaced').toBe(expected);
  });
});
