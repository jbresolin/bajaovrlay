// Starting and stopping the event inbox's machinery with the server: the detection, which
// records what the sources' new data shows happened.
import type { ServerLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { startEventDetection } from './eventDetection.js';

/** What the service needs: the store and the logger. */
export type EventInboxServiceOptions = { stateStore: StateStore; logger: ServerLogger };

/** The running service; stop() stops the detection. */
export type EventInboxService = { stop: () => void };

/**
 * Starts the event detection. Called by startServer once the store is loaded and before
 * the data-source service, so the first poll after a restart is seen (as the baseline).
 * Stopped with the server's other actors, before the database closes.
 */
export function startEventInboxService(options: EventInboxServiceOptions): EventInboxService {
  const detection = startEventDetection(options);
  options.logger.info('event detection started');
  return {
    stop: () => {
      detection.stop();
    },
  };
}
