/**
 * The replay adapter when reading a recording fails (apps/server)
 *
 * What this module is for:
 *   A recording file can be missing, unreadable, or hold no usable line. The replay then
 *   tells the operator why, in pt-BR, on every poll, and does not read the file again
 *   until the source is prepared again (turned off and on, or edited). Reading a large
 *   file that fails late again at every poll would load the server that renders the
 *   show, and polls called off while it loads would only ever say "Carregando a
 *   gravação…" (gate 2 re-check on PR #16).
 *
 * What these tests prove (a recording reader the test ends by hand, and Friday's
 * recording as what it reads):
 *   - A failed read fails the poll waiting for it with the read's pt-BR reason.
 *   - It is remembered: later polls fail with that reason at once and do not read again,
 *     even when it failed with no poll waiting for it.
 *   - A poll called off during the read says "Carregando a gravação…"; the poll after the
 *     read failed gives the real reason, not "loading" again.
 *   - Preparing the replay again reads the file again, and the poll then answers.
 *
 * What these tests deliberately do not cover:
 *   - A read that succeeds, and the abort signal; replayAdapterAbortSignal.test.ts.
 *   - The pt-BR reasons a real file read gives; replayAdapterLoading.test.ts and
 *     replayAdapter.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildPollContextAt,
  buildPollContextFiredBy,
  captureThePollError,
  createFridayReplayReadingThrough,
  createRecordingReaderFinishedByHand,
  fridayRecordingId,
  letPendingPromisesSettle,
  replayTurnedOnAtMs,
} from './replayAdapter.testSupport.js';

/** What the operator reads on the source while its recording is still being read. */
const stillLoadingMessage = 'Carregando a gravação…';

/** What the operator reads when Friday's recording file cannot be read. */
const unreadableFileMessage = `O arquivo da gravação "${fridayRecordingId}" não pôde ser lido.`;

/** The message of a poll's error, or undefined when there is none. */
function readTheErrorMessage(pollError: unknown): string | undefined {
  return pollError instanceof Error ? pollError.message : undefined;
}

describe('a read that fails', () => {
  it('fails the poll waiting for it with the read’s pt-BR reason', async () => {
    // Arrange: a replay prepared, and a poll waiting for its read.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    const polling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));

    // Act: the read fails, the file gone from the folder.
    recordingReader.failTheOldestRead(
      `O arquivo da gravação "${fridayRecordingId}" não foi encontrado.`,
    );

    // Assert: the waiting poll fails with the reason the operator reads.
    await expect(
      polling,
      'a failed read must fail the poll waiting for it, with its pt-BR reason',
    ).rejects.toThrow(`O arquivo da gravação "${fridayRecordingId}" não foi encontrado.`);
  });

  it('is remembered: later polls fail with its reason at once, without reading again', async () => {
    // Arrange: a replay prepared, and its read failing with no poll waiting for it (an
    // error nobody waits for must not crash the server).
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    recordingReader.failTheOldestRead(unreadableFileMessage);
    await letPendingPromisesSettle();

    // Act: two polls come, two seconds apart.
    const firstError = await captureThePollError(
      replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs)),
    );
    const secondError = await captureThePollError(
      replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs + 2_000)),
    );

    // Assert: both said why the file failed, and the file was read only the once.
    expect(
      [firstError, secondError].map(readTheErrorMessage),
      'every poll after a failed read must tell the operator its real reason',
    ).toEqual([unreadableFileMessage, unreadableFileMessage]);
    expect(
      recordingReader.readRecordingIdsRead(),
      'a failed read must not be read again at every poll',
    ).toEqual([fridayRecordingId]);
  });

  it('gives its real reason when every poll was called off before it failed', async () => {
    // Arrange: a replay prepared, and a poll waiting for its read.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    const abortController = new AbortController();
    const calledOffPolling = replayAdapter.pollOnce(
      config,
      buildPollContextFiredBy(abortController),
    );

    // Act: the poller calls the poll off, then the read fails, then the next poll comes.
    abortController.abort();
    const calledOffError = await captureThePollError(calledOffPolling);
    recordingReader.failTheOldestRead(unreadableFileMessage);
    await letPendingPromisesSettle();
    const nextError = await captureThePollError(
      replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs)),
    );

    // Assert: the called-off poll said it was loading; the next one gave the real reason,
    // without a second read.
    expect(
      readTheErrorMessage(calledOffError),
      'the poll called off during the read must say the recording is loading',
    ).toBe(stillLoadingMessage);
    expect(
      readTheErrorMessage(nextError),
      'the poll after the read failed must give its real reason, not "loading" again',
    ).toBe(unreadableFileMessage);
    expect(
      recordingReader.readRecordingIdsRead(),
      'the poll after the read failed must not start a second read',
    ).toEqual([fridayRecordingId]);
  });

  it('is read again when the replay is prepared again, and the poll then answers', async () => {
    // Arrange: a replay whose first read failed.
    const recordingReader = createRecordingReaderFinishedByHand();
    const { replayAdapter, config } = createFridayReplayReadingThrough(recordingReader);
    replayAdapter.prepareForPolling?.(config);
    recordingReader.failTheOldestRead(unreadableFileMessage);
    await letPendingPromisesSettle();

    // Act: the file is put back, the operator turns the source off and on (a prepare),
    // and a poll comes while the new read ends.
    replayAdapter.prepareForPolling?.(config);
    const polling = replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    recordingReader.finishTheOldestRead();
    const answer = await polling;

    // Assert: the recording was read a second time, and the poll answered.
    expect(
      recordingReader.readRecordingIdsRead(),
      'preparing the replay again must try the file again',
    ).toEqual([fridayRecordingId, fridayRecordingId]);
    expect(answer.shapes.positions, 'the poll after the file is back must answer').toHaveProperty(
      'entries.length',
      2,
    );
  });
});
