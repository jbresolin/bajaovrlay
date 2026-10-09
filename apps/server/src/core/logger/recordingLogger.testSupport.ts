// Test support: a real server logger whose JSON lines are kept in memory, so a test can
// check that a warning or an error was logged without reading stdout.
import { Writable } from 'node:stream';

import { createLogger, type ServerLogger } from './createLogger.js';

/** One parsed log line: always a level word and a message, plus whatever fields were logged. */
export type RecordedLogLine = { level: string; message: string } & Record<string, unknown>;

/** Creates a logger at level `trace` that remembers every line it writes. */
export function createRecordingLogger(): {
  logger: ServerLogger;
  readRecordedLines: () => RecordedLogLine[];
} {
  const recordedLines: RecordedLogLine[] = [];
  const memoryDestination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      recordedLines.push(JSON.parse(chunk.toString('utf8')) as RecordedLogLine);
      done();
    },
  });
  const logger = createLogger({ level: 'trace', destination: memoryDestination });
  return { logger, readRecordedLines: () => [...recordedLines] };
}
