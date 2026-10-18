// Starting and stopping the data-source machinery with the server. Today that is the
// poller; anything else that must run while sources are on (the recorder) starts here too.
import type { ServerLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import { startDataSourcePoller } from './poller.js';

/** What the service needs: the store, the logger and DATA_DIR (absolute). */
export type DataSourceServiceOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** DATA_DIR: recordings go in `<dataFolder>/recordings/<sourceId>/`. */
  dataFolder: string;
};

/** The running service; stop() stops polling and calls off every poll in flight. */
export type DataSourceService = { stop: () => void };

/**
 * Starts polling every source that is on, with the adapters the server knows. Called by
 * startServer once the store is loaded, and stopped first when the server closes, so no
 * poll answering late reaches a database that is closing.
 */
export function startDataSourceService(options: DataSourceServiceOptions): DataSourceService {
  const { stateStore, logger, dataFolder } = options;
  const poller = startDataSourcePoller({
    stateStore,
    logger,
    adapters: createDataSourceAdapters(),
  });
  logger.info({ data_folder: dataFolder }, 'data source service started');

  return {
    stop: () => {
      poller.stop();
    },
  };
}
