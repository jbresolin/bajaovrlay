// The `recordings` slice as the reducers keep it (decision D10): a recording opens on
// startRecording, empty; its count follows the recorder's reports of the lines it wrote
// (recordRecordingProgress, gate 2 on PR #16); it closes on stop, disable or delete.
// Nothing here touches a file.
import type { DataSource, Recording } from '@bajaovrlay/shared';

/**
 * The file name of a recording started at a moment: the moment in ISO 8601 with every
 * ':' made '-', because Windows refuses ':' in a file name (decision D10). A recording
 * number above 1 (a second recording of the same source started in the same
 * millisecond) is added after the moment: `…000Z-2.jsonl`.
 */
export function buildRecordingFileName(
  startedAtMs: number,
  recordingNumberInItsMillisecond = 1,
): string {
  const startedAtIso = new Date(startedAtMs).toISOString();
  const momentPart = startedAtIso.replaceAll(':', '-');
  if (recordingNumberInItsMillisecond === 1) {
    return `${momentPart}.jsonl`;
  }
  return `${momentPart}-${String(recordingNumberInItsMillisecond)}.jsonl`;
}

/**
 * The start moment written in a recording's file name (the reverse of
 * buildRecordingFileName, with or without its `-<number>`), or undefined for a name that
 * is not exactly such a moment (a file renamed by hand).
 */
export function readStartMomentFromRecordingFileName(fileName: string): number | undefined {
  return readRecordingFileName(fileName)?.startedAtMs;
}

/**
 * The recording number written in a recording's file name: 1 when it has no `-<number>`,
 * 2 for `…000Z-2.jsonl`, and so on; undefined for a file renamed by hand. It orders the
 * recordings of one millisecond as they were started, which the names' text does not
 * ('-' sorts before '.', and "-10" before "-2").
 */
export function readRecordingNumberFromRecordingFileName(fileName: string): number | undefined {
  return readRecordingFileName(fileName)?.recordingNumberInItsMillisecond;
}

/**
 * The start moment and the recording number of a file name built by
 * buildRecordingFileName, or undefined for any other name. Checked by building the name
 * again from the moment and the number found.
 */
function readRecordingFileName(
  fileName: string,
): { startedAtMs: number; recordingNumberInItsMillisecond: number } | undefined {
  // `<date>T<time>Z`, then `-<number>` for a second recording of the same millisecond.
  const nameParts = /^(?<datePart>[^T]+)T(?<timePart>[^Z]+)Z(?:-(?<number>\d+))?\.jsonl$/.exec(
    fileName,
  );
  const datePart = nameParts?.groups?.datePart;
  const timePart = nameParts?.groups?.timePart;
  if (datePart === undefined || timePart === undefined) {
    return undefined;
  }
  const startedAtIso = `${datePart}T${timePart.replaceAll('-', ':')}Z`;
  const startedAtMs = Date.parse(startedAtIso);
  if (Number.isNaN(startedAtMs)) {
    return undefined;
  }
  const recordingNumberInItsMillisecond = Number(nameParts?.groups?.number ?? '1');
  const isTheNameExactlyThatMoment =
    buildRecordingFileName(startedAtMs, recordingNumberInItsMillisecond) === fileName;
  if (!isTheNameExactlyThatMoment) {
    return undefined;
  }
  return { startedAtMs, recordingNumberInItsMillisecond };
}

/**
 * The entry of a recording of this source starting now, still open and empty. Its file
 * name is the moment; when the source already has a recording of that very millisecond
 * (start, stop and start again within it), the first free number is added, so the new
 * recording never appends to the earlier one's file (gate 2 on PR #16).
 */
export function buildRecordingStartingNow(
  source: DataSource,
  nowMs: number,
  recordings: Recording[],
): Recording {
  const fileNamesOfTheSource = new Set(
    recordings
      .filter((recording) => recording.sourceId === source.id)
      .map((recording) => recording.fileName),
  );
  let recordingNumberInItsMillisecond = 1;
  while (fileNamesOfTheSource.has(buildRecordingFileName(nowMs, recordingNumberInItsMillisecond))) {
    recordingNumberInItsMillisecond += 1;
  }
  const fileName = buildRecordingFileName(nowMs, recordingNumberInItsMillisecond);
  return {
    id: `${source.id}/${fileName}`,
    sourceId: source.id,
    sourceLabel: source.label,
    fileName,
    startedAtMs: nowMs,
    endedAtMs: null,
    snapshotCount: 0,
  };
}

/**
 * Closes the open recording of a source at this moment. Hands back the very same list
 * when the source has no open recording, so the store sees no change.
 */
export function closeOpenRecordingOfSource(
  recordings: Recording[],
  sourceId: string,
  nowMs: number,
): Recording[] {
  const isAnyRecordingOpen = recordings.some((recording) =>
    isOpenRecordingOfSource(recording, sourceId),
  );
  if (!isAnyRecordingOpen) {
    return recordings;
  }
  return recordings.map((recording) =>
    isOpenRecordingOfSource(recording, sourceId) ? { ...recording, endedAtMs: nowMs } : recording,
  );
}

/**
 * Sets the count of one recording, open or closed, to the number of lines the recorder
 * reports in its file. Hands back the very same list when no recording has that id or
 * its count is already that number, so the store sees no change.
 */
export function setSnapshotCountOfRecording(
  recordings: Recording[],
  recordingId: string,
  snapshotCount: number,
): Recording[] {
  const isAnyCountChanged = recordings.some(
    (recording) => recording.id === recordingId && recording.snapshotCount !== snapshotCount,
  );
  if (!isAnyCountChanged) {
    return recordings;
  }
  return recordings.map((recording) =>
    recording.id === recordingId ? { ...recording, snapshotCount } : recording,
  );
}

/** Whether a recording is this source's and still being recorded. */
function isOpenRecordingOfSource(recording: Recording, sourceId: string): boolean {
  return recording.sourceId === sourceId && recording.endedAtMs === null;
}
