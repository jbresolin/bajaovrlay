// What main.ts does on SIGTERM (`docker stop`, a Portainer redeploy) or SIGINT (Ctrl+C):
// close the running server, then exit. Kept apart from main.ts so a test can drive it.
import type { ServerLogger } from '../logger/createLogger.js';
import type { RunningServer } from './startServer.js';

/**
 * Logs the signal, closes the server (pollers, WebSocket clients, the port, the database)
 * and exits 0. If closing throws, logs it and exits 1 at once, rather than leaving the
 * process hanging until Docker's kill with nothing in the log saying why.
 */
export async function shutDownTheServer(options: {
  runningServer: Pick<RunningServer, 'close'>;
  logger: ServerLogger;
  signal: NodeJS.Signals;
  exitProcess: (code: number) => void;
}): Promise<void> {
  options.logger.info({ signal: options.signal }, 'server shutting down');
  try {
    await options.runningServer.close();
  } catch (closeError) {
    options.logger.fatal({ err: closeError, signal: options.signal }, 'server shutdown failed');
    options.exitProcess(1);
    return;
  }
  options.exitProcess(0);
}
