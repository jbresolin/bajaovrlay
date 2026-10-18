// Reading the two ends of a recording file, byte by byte, without reading the lines in
// between: the boot listing needs only the first and the last line of each file, so a
// boot does not slow down with every hour recorded (gate 2 on PR #16).
import { readSync } from 'node:fs';

import { parseRecordedLine, type RecordedLine } from './recordingLine.js';

// How many bytes are read at a time from either end of a recording file. A 60-car line
// is about 25 KB, so one read usually holds the last two lines; a longer line makes the
// read grow (doubling) until it holds them.
const bytesReadAtATime = 64 * 1024;

// How many bytes are read at a time when an old file's lines must be counted one by one
// (lines written before they carried their number): 1 MB, a plain streaming read.
const bytesReadAtATimeWhenCounting = 1024 * 1024;

/** What the boot listing needs from the end of a recording file. */
export type EndOfARecordingFile = {
  /** The last whole recorded line, or undefined when the file holds none. */
  lastLine: RecordedLine | undefined;
  /** Whether the file ends on a line that is not a whole recorded line (a power cut). */
  isLastLineCutOff: boolean;
};

/**
 * Reads the end of an open recording file, backwards from its last byte, until it holds
 * its last two lines (or the whole file): the last whole recorded line, and whether the
 * file ends on a line cut off. A read that fails throws.
 */
export function readTheEndOfARecordingFile(
  fileDescriptor: number,
  fileSizeInBytes: number,
): EndOfARecordingFile {
  let bytesToRead = bytesReadAtATime;
  let lineTexts = readTheLastLineTexts(fileDescriptor, fileSizeInBytes, bytesToRead);
  let isTheWholeFileRead = bytesToRead >= fileSizeInBytes;
  while (lineTexts.length < 2 && !isTheWholeFileRead) {
    bytesToRead *= 2;
    lineTexts = readTheLastLineTexts(fileDescriptor, fileSizeInBytes, bytesToRead);
    isTheWholeFileRead = bytesToRead >= fileSizeInBytes;
  }
  return findTheLastWholeLine(lineTexts);
}

/**
 * The non-empty line texts in the last bytesToRead bytes of a file. The first piece of a
 * read that starts mid-file is dropped, because it may start mid-line; a '\n' byte never
 * sits inside a UTF-8 character, so every piece after it is a line as written.
 */
function readTheLastLineTexts(
  fileDescriptor: number,
  fileSizeInBytes: number,
  bytesToRead: number,
): string[] {
  const readStartsAtByte = Math.max(0, fileSizeInBytes - bytesToRead);
  const tailText = readBytesAsText(fileDescriptor, readStartsAtByte, fileSizeInBytes);
  const pieces = tailText.split('\n');
  const isReadFromTheStart = readStartsAtByte === 0;
  const wholePieces = isReadFromTheStart ? pieces : pieces.slice(1);
  return wholePieces.filter((piece) => piece.trim() !== '');
}

/**
 * The last whole recorded line among the last line texts of a file: the very last one,
 * or, when that one is not a recorded line (cut off), the one before it.
 */
function findTheLastWholeLine(lineTexts: string[]): EndOfARecordingFile {
  const lastLineText = lineTexts.at(-1);
  if (lastLineText === undefined) {
    return { lastLine: undefined, isLastLineCutOff: false };
  }
  const lastLine = parseRecordedLine(lastLineText);
  if (lastLine !== undefined) {
    return { lastLine, isLastLineCutOff: false };
  }
  const lineTextBeforeTheLast = lineTexts.at(-2);
  const lineBeforeTheLast =
    lineTextBeforeTheLast === undefined ? undefined : parseRecordedLine(lineTextBeforeTheLast);
  return { lastLine: lineBeforeTheLast, isLastLineCutOff: true };
}

/**
 * The first line of an open recording file, read forwards a chunk at a time until its
 * newline (or the end of the file), or undefined when it is not a recorded line.
 */
export function readTheFirstLineOfARecordingFile(
  fileDescriptor: number,
  fileSizeInBytes: number,
): RecordedLine | undefined {
  let bytesToRead = bytesReadAtATime;
  let headText = readBytesAsText(fileDescriptor, 0, Math.min(fileSizeInBytes, bytesToRead));
  let isTheWholeFileRead = bytesToRead >= fileSizeInBytes;
  while (!headText.includes('\n') && !isTheWholeFileRead) {
    bytesToRead *= 2;
    headText = readBytesAsText(fileDescriptor, 0, Math.min(fileSizeInBytes, bytesToRead));
    isTheWholeFileRead = bytesToRead >= fileSizeInBytes;
  }
  const newlineIndex = headText.indexOf('\n');
  const firstLineText = newlineIndex === -1 ? headText : headText.slice(0, newlineIndex);
  return parseRecordedLine(firstLineText);
}

/**
 * The number of whole lines of an open file (its '\n' bytes), read a megabyte at a time
 * and never parsed. Only for files whose lines carry no snapshotNumber.
 */
export function countTheWholeLinesOfAFile(fileDescriptor: number, fileSizeInBytes: number): number {
  const newlineByte = 0x0a;
  const chunk = Buffer.alloc(bytesReadAtATimeWhenCounting);
  let lineCount = 0;
  for (let position = 0; position < fileSizeInBytes; position += chunk.length) {
    const bytesRead = readSync(fileDescriptor, chunk, 0, chunk.length, position);
    for (let byteIndex = 0; byteIndex < bytesRead; byteIndex += 1) {
      if (chunk[byteIndex] === newlineByte) {
        lineCount += 1;
      }
    }
  }
  return lineCount;
}

/** The bytes of a file from one position up to (not including) another, as UTF-8 text. */
function readBytesAsText(fileDescriptor: number, fromByte: number, toByte: number): string {
  const bytes = Buffer.alloc(toByte - fromByte);
  const bytesRead = readSync(fileDescriptor, bytes, 0, bytes.length, fromByte);
  return bytes.subarray(0, bytesRead).toString('utf8');
}
