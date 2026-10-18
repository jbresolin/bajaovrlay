/**
 * The recordings the replay form offers (apps/control)
 *
 * What this module is for:
 *   The replay form ("Reprodução") offers the recordings an operator can rehearse with.
 *   A recording still being written cannot be replayed (the server refuses it), and the
 *   one the operator wants is almost always the one just made, so the list puts the
 *   newest first (gate 2 on PR #16).
 *
 * What these tests prove:
 *   - Only recordings that have ended are offered, newest first, whatever order the
 *     server's slice has them in.
 *
 * What these tests deliberately do not cover:
 *   - The picker on the page and the replay sent with the chosen one:
 *     DataSourcesPageForms.test.tsx.
 */
import type { Recording } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildFridaysEndedRecording,
  buildRecordingStillOpen,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { listRecordingsOfferedForReplay } from './recordingsOfferedForReplay';

/** Saturday morning's practice, recorded after Friday's session and ended. */
function buildSaturdayMorningRecording(): Recording {
  return {
    ...buildFridaysEndedRecording(),
    id: 'simulador-enduro/2027-03-20T11-00-00.000Z.jsonl',
    fileName: '2027-03-20T11-00-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-03-20T11:00:00.000Z'),
    endedAtMs: Date.parse('2027-03-20T11:20:00.000Z'),
    snapshotCount: 600,
  };
}

describe('listRecordingsOfferedForReplay', () => {
  it('offers the ended recordings only, newest first', () => {
    // Arrange: the slice as the server sends it, oldest first: Friday's, Saturday
    // morning's, and the one being written now.
    const recordings = [
      buildFridaysEndedRecording(),
      buildSaturdayMorningRecording(),
      buildRecordingStillOpen(),
    ];

    // Act: list what the form offers.
    const offered = listRecordingsOfferedForReplay(recordings);

    // Assert: Saturday morning's, then Friday's; the open one is not offered.
    expect(
      offered.map((recording) => recording.fileName),
      'the newest ended recording must come first, and an open one must not be offered',
    ).toEqual(['2027-03-20T11-00-00.000Z.jsonl', '2027-03-19T13-00-00.000Z.jsonl']);
  });
});
