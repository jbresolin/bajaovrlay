// The poller's preparation step: when a source is prepared again, and preparing it
// without letting a buggy adapter break the store's listener.
import { areJsonValuesEqual, type DataSource } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import {
  type DataSourceAdapters,
  prepareDataSourceWithTheAdapterOfItsKind,
} from './adapters/createDataSourceAdapters.js';

/**
 * Whether the source's config differs from the one it was last prepared with. Compared
 * by content, not by object: every change of the sources (a poll result too) hands over
 * new source objects, but only an edited config is new to prepare.
 */
export function hasTheConfigChangedSinceItWasPrepared(
  source: DataSource,
  lastPreparedConfig: DataSource['config'],
): boolean {
  return !areJsonValuesEqual(source.config, lastPreparedConfig);
}

/**
 * Asks the source's adapter to start its slow preparation (prepareForPolling). The
 * poller calls this inside the store's listener, which is safe because it only starts
 * work and sends no command. An adapter must not throw here, but a buggy one that does
 * is logged: the throw would otherwise escape into the store's listener and the command
 * that caused it. The source is still polled either way.
 */
export function prepareSourceForPollingAndLogACrash(
  source: DataSource,
  adapters: DataSourceAdapters,
  logger: ServerLogger,
): void {
  try {
    prepareDataSourceWithTheAdapterOfItsKind(source, adapters);
  } catch (prepareError) {
    logger.error({ err: prepareError, source_id: source.id }, 'data source preparation crashed');
  }
}
