// Starting and stopping the data-source machinery with the server: the poller (which
// asks every source that is on for data) and the recorder (which writes the data of a
// recording source to its file).
import type { ServerLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { createDataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import { startDataSourcePoller } from './poller.js';
import { startDataSourceRecorder } from './recorder.js';
import { buildRecordingsFolderPath } from './recordingsFromFolder.js';

/** What the service needs: the store, the logger and DATA_DIR (absolute). */
export type DataSourceServiceOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** DATA_DIR: recordings go in `<dataFolder>/recordings/<sourceId>/`. */
  dataFolder: string;
};

/** The running service; stop() stops polling and recording, calling off every poll in flight. */
export type DataSourceService = { stop: () => void };

/**
 * Starts recording and polling every source that is on, with the adapters the server
 * knows (the replay reads the recordings folder). Called by startServer once the store
 * is loaded, and stopped first when the server closes, so no poll answering late and no
 * recorder's stop reaches a database that is closing. The recorder starts first so it
 * sees every snapshot the poller's first answers bring.
 */
export function startDataSourceService(options: DataSourceServiceOptions): DataSourceService {
  const { stateStore, logger, dataFolder } = options;
  const recordingsFolder = buildRecordingsFolderPath(dataFolder);
  const recorder = startDataSourceRecorder({ stateStore, logger, recordingsFolder });
  const poller = startDataSourcePoller({
    stateStore,
    logger,
    adapters: createDataSourceAdapters({ recordingsFolder, logger }),
  });
  logger.info({ data_folder: dataFolder }, 'data source service started');

  return {
    stop: () => {
      poller.stop();
      recorder.stop();
    },
  };
}
