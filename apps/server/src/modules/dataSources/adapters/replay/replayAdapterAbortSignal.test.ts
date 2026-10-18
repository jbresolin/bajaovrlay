/**
 * The replay adapter, preparing a recording and honouring the abort signal (apps/server)
 *
 * What this module is for:
 *   Reading a recording of a whole enduro into memory takes about a second. The replay
 *   starts that read when the poller prepares it (the source turned on, or its config
 *   edited), not inside a poll, and a poll waiting for the read stops as soon as its
 *   signal fires, answering a clear "Carregando a gravação…" instead of running into a
 *   timeout. The read carries on, so the next poll answers (gate 2 re-check on PR #16).
 *
 * What these tests prove (a recording reader the test ends by hand, so "while the read is
 * still going" is exact, and Friday's recording as what it reads):
 *   - prepareForPolling starts the read; a poll then answers from that one read.
 *   - A poll whose signal fires during the read rejects at once with "Carregando a
 *     gravação…" (an error the poller tells from a timeout), the read still going; the
 *     next poll answers from that same read.
 *   - A poll whose signal had fired before it began rejects the same way and starts the
 *     read, so the next poll can answer.
 *   - A poll with no prepare first starts the read itself and waits for it.
 *   - Two prepares and two polls during one read read the recording once.
 *   - Preparing another recording (the replay's config edited) reads that one.
 *
 * What these tests deliberately do not cover:
 *   - Reading a real file as a stream and its memory bound; replayAdapterLoading.test.ts
 *     and replayAdapter.test.ts.
 *   - A read that fails; replayAdapterFailedRead.test.ts.
 *   - The poller calling prepareForPolling; pollerPreparesSources.test.ts. A large
 *     recording through the real poller; ../../replayPollingWhileLoading.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { StillPreparingForPollingError } from '../dataSourceAdapter.js';
import {
  buildPollContextAt,
  buildPollContextFiredBy,
  captureThePollError,
  createFridayReplayReadingThrough,
  createRecordingReaderFinishedByHand,
  fridayRecordingId,
  letPendingPromisesSettle,
  replayTurnedOnAtMs,
  saturdayWarmUpRecordingId,
} from './replayAdapter.testSupport.js';

/** What the operator reads on the source while its recording is still being read. */
const stillLoadingMessage = 'Carregando a gravação…';

describe('preparing a recording', () => {
  it('starts reading the recording when prepared, and the poll answers from that read', async () => {
    // Arrange: a replay of Friday's recording, whose reads the test ends by hand.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);

    // Act: the poller prepares the replay, a poll starts, then the read ends.
    replayAdapter.prepareForPolling?.(config);
    const recordingIdsReadBeforeThePoll = recordingReader.readRecordingIdsRead();
    const polling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    recordingReader.finishTheOldestRead();
    const answer = await polling;

    // Assert: the read started at the prepare, once, and the poll answered Friday's cars.
    expect(
      recordingIdsReadBeforeThePoll,
      'preparing the replay must start reading its recording before any poll',
    ).toEqual([fridayRecordingId]);
    expect(
      recordingReader.readRecordingIdsRead(),
      'the poll must answer from the read the prepare started, not read again',
    ).toEqual([fridayRecordingId]);
    expect(answer.shapes.positions, 'the poll must answer the recorded cars').toHaveProperty(
      'entries.length',
      2,
    );
  });

  it('reads a recording once when it is prepared twice and polled twice during the read', async () => {
    // Arrange: a replay of Friday's recording, whose reads the test ends by hand.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);

    // Act: two prepares (the source turned on, then an edit), two polls, then the read ends.
    replayAdapter.prepareForPolling?.(config);
    replayAdapter.prepareForPolling?.(config);
    const firstPolling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    const secondPolling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    recordingReader.finishTheOldestRead();
    await Promise.all([firstPolling, secondPolling]);

    // Assert: one read for all of them.
    expect(
      recordingReader.readRecordingIdsRead(),
      'a recording being read must not be read a second time',
    ).toEqual([fridayRecordingId]);
  });

  it('reads the other recording when prepared with a config that names another one', async () => {
    // Arrange: a replay of Friday's recording, prepared and read.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    recordingReader.finishTheOldestRead();
    await letPendingPromisesSettle();

    // Act: the operator edits the replay to play Saturday's warm-up instead.
    replayAdapter.prepareForPolling?.({ ...config, recordingId: saturdayWarmUpRecordingId });

    // Assert: Saturday's recording is being read at once, before any poll asks for it.
    expect(
      recordingReader.readRecordingIdsRead(),
      'an edited replay must start reading its new recording at once',
    ).toEqual([fridayRecordingId, saturdayWarmUpRecordingId]);
  });
});

describe('a poll while the recording is being read', () => {
  it('rejects at once with "Carregando a gravação…" when its signal fires, and the next poll answers', async () => {
    // Arrange: a replay prepared, its read still going, and a poll waiting for it.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    const abortController = new AbortController();
    const firstPolling = replayAdapter.pollOnce(config, buildPollContextFiredBy(abortController));

    // Act: the poller calls the poll off (its timeout) while the read is still going;
    // then the read ends and the next poll comes.
    abortController.abort();
    const firstError = await captureThePollError(firstPolling);
    const readsInFlightWhenThePollRejected = recordingReader.countReadsInFlight();
    recordingReader.finishTheOldestRead();
    const nextAnswer = await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));

    // Assert: the called-off poll said it was loading, before the read ended, as an error
    // the poller tells from a timeout; the read carried on; the next poll answered.
    expect(
      firstError,
      'a called-off poll must say the recording is loading, in pt-BR',
    ).toHaveProperty('message', stillLoadingMessage);
    expect(
      firstError,
      'the poller must be able to tell "still loading" from a source too slow to answer',
    ).toBeInstanceOf(StillPreparingForPollingError);
    expect(
      readsInFlightWhenThePollRejected,
      'the called-off poll must reject at once, while the read is still going',
    ).toBe(1);
    expect(
      nextAnswer.shapes.positions,
      'the read must carry on after the poll is called off, so the next poll answers',
    ).toHaveProperty('entries.length', 2);
    expect(
      recordingReader.readRecordingIdsRead(),
      'calling a poll off must not start the read over',
    ).toEqual([fridayRecordingId]);
  });

  it('rejects at once when its signal had already fired, and starts the read for the next poll', async () => {
    // Arrange: a replay never prepared, and a signal that has already fired.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    const abortController = new AbortController();
    abortController.abort();

    // Act: a poll with that signal, then the read ends and the next poll comes.
    const calledOffError = await captureThePollError(
      replayAdapter.pollOnce(config, buildPollContextFiredBy(abortController)),
    );
    const recordingIdsReadByTheCalledOffPoll = recordingReader.readRecordingIdsRead();
    recordingReader.finishTheOldestRead();
    const nextAnswer = await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));

    // Assert: the called-off poll said it was loading and still started the read, and
    // the next poll answered.
    expect(
      calledOffError,
      'a poll called off before it began must say the recording is loading',
    ).toHaveProperty('message', stillLoadingMessage);
    expect(
      calledOffError,
      'the poller must be able to tell "still loading" from a source too slow to answer',
    ).toBeInstanceOf(StillPreparingForPollingError);
    expect(
      recordingIdsReadByTheCalledOffPoll,
      'a called-off poll must still start the read, so a later poll can answer',
    ).toEqual([fridayRecordingId]);
    expect(nextAnswer.shapes.positions, 'the next poll must answer').toHaveProperty(
      'entries.length',
      2,
    );
  });

  it('starts the read itself when no prepare came first, and waits for it', async () => {
    // Arrange: a replay never prepared.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);

    // Act: a poll, then the read ends.
    const polling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    const recordingIdsReadByThePoll = recordingReader.readRecordingIdsRead();
    recordingReader.finishTheOldestRead();
    const answer = await polling;

    // Assert: the poll started the read and answered once it ended.
    expect(
      recordingIdsReadByThePoll,
      'a poll with no prepare before it must start the read itself',
    ).toEqual([fridayRecordingId]);
    expect(answer.shapes.positions, 'the poll must answer once the read ends').toHaveProperty(
      'entries.length',
      2,
    );
  });
});
