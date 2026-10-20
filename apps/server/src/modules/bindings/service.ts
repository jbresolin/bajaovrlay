// Starting and stopping the bindings machinery with the server: the refresher, which
// writes a source's new values into the instances bound to it live.
import type { ServerLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { startLiveRefresher } from './liveRefresher.js';

/** What the service needs: the store and the logger. */
export type BindingServiceOptions = { stateStore: StateStore; logger: ServerLogger };

/** The running service; stop() calls off a pending refresh. */
export type BindingService = { stop: () => void };

/**
 * Starts the refresher of bound fields. Called by startServer once the store is loaded,
 * before the data-source service, so the first poll after a restart already refreshes
 * what was on air; stopped with the server's other actors, before the database closes.
 */
export function startBindingService(options: BindingServiceOptions): BindingService {
  const refresher = startLiveRefresher(options);
  options.logger.info('binding refresher started');
  return { stop: () => refresher.stop() };
}
