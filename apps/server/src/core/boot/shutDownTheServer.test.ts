/**
 * Shutting the server down on a signal (apps/server)
 *
 * What this module is for:
 *   `docker stop`, a Portainer redeploy and Ctrl+C send the server SIGTERM or SIGINT.
 *   main.ts then closes everything (pollers, WebSocket clients, the port, the database)
 *   and exits. If closing failed and nothing caught it, the process would hang until
 *   Docker's kill 10 s later, with nothing in the log saying why (gate 2 of PR #37).
 *
 * What these tests prove (with a stand-in for the running server and for process.exit):
 *   - A close that works logs the shutdown and exits 0.
 *   - A close that throws logs the error and exits 1, at once.
 *
 * What these tests deliberately do not cover:
 *   - What close() itself closes, and in which order: core/boot/startServer.test.ts.
 *   - A close that never ends: Docker's 10 s kill is the limit, as for any process.
 */
import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { shutDownTheServer } from './shutDownTheServer.js';

/** A stand-in for process.exit that remembers the codes it was called with. */
function createExitRecorder(): { exitProcess: (code: number) => void; exitCodes: number[] } {
  const exitCodes: number[] = [];
  return { exitProcess: (code) => exitCodes.push(code), exitCodes };
}

describe('shutDownTheServer', () => {
  it('logs the shutdown and exits 0 once the server has closed', async () => {
    // Arrange: a server whose close works, a recording logger, and a stand-in exit.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { exitProcess, exitCodes } = createExitRecorder();
    const runningServer = { close: () => Promise.resolve() };

    // Act: shut down on the SIGTERM of `docker stop`.
    await shutDownTheServer({ runningServer, logger, signal: 'SIGTERM', exitProcess });

    // Assert: one exit, with 0, after the line naming the signal.
    expect(exitCodes, 'a clean shutdown exits 0, once').toEqual([0]);
    expect(
      readRecordedLines().map((line) => [line.level, line.message, line.signal]),
      'the log names the signal',
    ).toEqual([['info', 'server shutting down', 'SIGTERM']]);
  });

  it('logs the error and exits 1 when closing the server fails', async () => {
    // Arrange: a server whose close throws, as a database that cannot close would.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { exitProcess, exitCodes } = createExitRecorder();
    const runningServer = {
      close: () => Promise.reject(new Error('database is locked')),
    };

    // Act: shut down on the SIGTERM of `docker stop`.
    await shutDownTheServer({ runningServer, logger, signal: 'SIGTERM', exitProcess });

    // Assert: one exit, with 1, and a fatal line carrying the error.
    expect(exitCodes, 'a failed close exits 1 at once, not after Docker’s kill').toEqual([1]);
    const fatalLine = readRecordedLines().find((line) => line.level === 'fatal');
    expect(fatalLine?.message, 'the log says the shutdown failed').toBe('server shutdown failed');
    expect(fatalLine?.err, 'the log carries the error').toMatchObject({
      message: 'database is locked',
    });
  });
});
